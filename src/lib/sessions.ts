import fs from 'node:fs';
import path from 'node:path';
import { Notification } from 'electron';
import type { ActiveSession, AggregatedStats, AppSettings } from '../types';
import { getProjectName } from '../types';

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const IDLE_THRESHOLD_MS   = 15 * 60 * 1000;

// ─── Session end tracking ─────────────────────────────────────────────────────
export const trackedSessions = new Map<string, { projectName: string; cost: number }>();

// ─── Active session detection ─────────────────────────────────────────────────
export async function getActiveSessions(
  claudeDir: string,
  sessionEndMs: number,
  cachedStats: AggregatedStats | null,
): Promise<ActiveSession[]> {
  const now = Date.now();
  const result: ActiveSession[] = [];

  try {
    await fs.promises.access(claudeDir);
  } catch {
    return result;
  }

  let projectDirs: string[] = [];
  try {
    const entries = await fs.promises.readdir(claudeDir, { withFileTypes: true });
    projectDirs = entries.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return result;
  }

  for (const projectSlug of projectDirs) {
    const projectDir = path.join(claudeDir, projectSlug);
    let files: string[] = [];
    try {
      const all = await fs.promises.readdir(projectDir);
      files = all.filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(projectDir, file);
      try {
        const stat = await fs.promises.stat(filePath);
        const mtime = stat.mtimeMs;
        const age = now - mtime;
        if (age > sessionEndMs) continue;

        const sessionId = path.basename(file, '.jsonl');
        const cached = cachedStats?.sessions.find((s) => s.sessionId === sessionId);
        const isIdle = age > IDLE_THRESHOLD_MS;

        let burnRatePerMin = 0;
        if (cached) {
          const start = new Date(cached.startTime).getTime();
          const durationMin = Math.max(1, (now - start) / 60000);
          burnRatePerMin = cached.totalCost / durationMin;
        }

        // Extract recent user messages from JSONL
        const recentUserMessages: string[] = [];
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          for (const line of content.split('\n')) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === 'user' || obj.role === 'user') {
                const raw = obj.message?.content;
                let text = '';
                if (typeof raw === 'string') text = raw.trim();
                else if (Array.isArray(raw)) {
                  text = raw
                    .filter((c: unknown) => c !== null && typeof c === 'object' && (c as Record<string, unknown>).type === 'text' && typeof (c as Record<string, unknown>).text === 'string')
                    .map((c: unknown) => (c as Record<string, unknown>).text as string)
                    .join('\n')
                    .trim();
                }
                if (text) recentUserMessages.push(text.slice(0, 300));
              }
            } catch { /* skip malformed lines */ }
          }
        } catch { /* skip unreadable files */ }

        result.push({
          sessionId,
          projectPath: projectSlug,
          projectName: getProjectName(projectSlug),
          startTime: cached?.startTime ?? new Date(stat.birthtimeMs || mtime).toISOString(),
          currentInput: cached?.totalInput ?? 0,
          currentOutput: cached?.totalOutput ?? 0,
          currentCacheWrite: cached?.totalCacheWrite ?? 0,
          currentCacheRead: cached?.totalCacheRead ?? 0,
          currentCost: cached?.totalCost ?? 0,
          messageCount: cached?.messageCount ?? 0,
          lastMessageTime: new Date(mtime).toISOString(),
          burnRatePerMin,
          isIdle,
          recentUserMessages: recentUserMessages.slice(-8),
        });
      } catch {
        continue;
      }
    }
  }

  return result.sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
  );
}

// ─── Monthly cost helper ──────────────────────────────────────────────────────
export function getCurrentMonthCost(cachedStats: AggregatedStats | null): number {
  if (!cachedStats) return 0;
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return cachedStats.daily
    .filter((d) => d.date.startsWith(prefix))
    .reduce((a, d) => a + d.totalCost, 0);
}

// ─── Notifications ────────────────────────────────────────────────────────────
export function sendNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

// ─── Budget alerts ────────────────────────────────────────────────────────────
export function checkBudgetAlerts(
  settings: AppSettings,
  cachedStats: AggregatedStats | null,
  saveSettings: (s: AppSettings) => void,
): void {
  const { budget } = settings;
  if (!budget.monthlyBudget || budget.monthlyBudget <= 0) return;

  const nowMonth = new Date().toISOString().slice(0, 7);
  if (budget.alertResetMonth !== nowMonth) {
    settings.budget.alert80Sent = false;
    settings.budget.alert100Sent = false;
    settings.budget.alertResetMonth = nowMonth;
    saveSettings(settings);
  }

  const monthCost = getCurrentMonthCost(cachedStats);
  const ratio = monthCost / budget.monthlyBudget;

  if (budget.alertAt80 && !budget.alert80Sent && ratio >= 0.8 && ratio < 1.0) {
    sendNotification(
      '예산 경고: 80% 도달',
      `이번 달 지출이 $${monthCost.toFixed(2)} / $${budget.monthlyBudget.toFixed(2)} (${Math.round(ratio * 100)}%)에 도달했습니다.`,
    );
    settings.budget.alert80Sent = true;
    saveSettings(settings);
  }

  if (budget.alertAt100 && !budget.alert100Sent && ratio >= 1.0) {
    sendNotification(
      '예산 초과!',
      `이번 달 지출 $${monthCost.toFixed(2)}이(가) 예산 $${budget.monthlyBudget.toFixed(2)}을(를) 초과했습니다.`,
    );
    settings.budget.alert100Sent = true;
    saveSettings(settings);
  }
}

// ─── Session end detection ────────────────────────────────────────────────────
export async function checkSessionEnds(
  claudeDir: string,
  sessionEndMs: number,
  cachedStats: AggregatedStats | null,
  onEnded: () => void,
): Promise<void> {
  const currentActive = await getActiveSessions(claudeDir, sessionEndMs, cachedStats);
  const currentIds = new Set(currentActive.map((s) => s.sessionId));

  for (const s of currentActive) {
    if (!s.isIdle) {
      trackedSessions.set(s.sessionId, { projectName: s.projectName, cost: s.currentCost });
    }
  }

  let anyEnded = false;
  for (const [sessionId, info] of trackedSessions) {
    if (!currentIds.has(sessionId)) {
      const monthCost = getCurrentMonthCost(cachedStats);
      sendNotification(
        `세션 종료: ${info.projectName}`,
        `세션 비용 $${info.cost.toFixed(4)} · 이번 달 누적 $${monthCost.toFixed(4)}`,
      );
      trackedSessions.delete(sessionId);
      anyEnded = true;
    }
  }

  if (anyEnded) onEnded();
}
