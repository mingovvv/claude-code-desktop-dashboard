import fs from 'node:fs';
import path from 'node:path';
import type { AggregatedStats, DailyStats, ProjectStats } from '../types';
import { parseSessionFile, emptyStats } from './parser';

// ─── Full stats aggregation ───────────────────────────────────────────────────
export async function aggregateStats(claudeDir: string): Promise<AggregatedStats> {
  const sessions = [];
  let parseErrors = 0;

  if (!fs.existsSync(claudeDir)) return emptyStats();

  let projectDirs: string[] = [];
  try {
    projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return emptyStats();
  }

  for (const projectSlug of projectDirs) {
    const projectDir = path.join(claudeDir, projectSlug);
    let files: string[] = [];
    try {
      files = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(projectDir, file);
      try {
        const session = await parseSessionFile(filePath, projectSlug);
        if (session) sessions.push(session);
      } catch {
        parseErrors++;
      }
    }
  }

  // Build daily stats
  const dailyMap = new Map<string, DailyStats>();
  for (const s of sessions) {
    const date = s.startTime.slice(0, 10);
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        totalInput: 0,
        totalOutput: 0,
        totalCacheWrite: 0,
        totalCacheRead: 0,
        totalCost: 0,
        messageCount: 0,
        sessionCount: 0,
      });
    }
    const d = dailyMap.get(date)!;
    d.totalInput      += s.totalInput;
    d.totalOutput     += s.totalOutput;
    d.totalCacheWrite += s.totalCacheWrite;
    d.totalCacheRead  += s.totalCacheRead;
    d.totalCost       += s.totalCost;
    d.messageCount    += s.messageCount;
    d.sessionCount    += 1;
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Build project stats
  const projectMap = new Map<string, ProjectStats>();
  for (const s of sessions) {
    if (!projectMap.has(s.projectPath)) {
      projectMap.set(s.projectPath, {
        projectPath: s.projectPath,
        projectName: s.projectName,
        totalInput: 0,
        totalOutput: 0,
        totalCacheWrite: 0,
        totalCacheRead: 0,
        totalCost: 0,
        sessionCount: 0,
        messageCount: 0,
        lastActive: s.endTime,
        models: {},
      });
    }
    const p = projectMap.get(s.projectPath)!;
    p.totalInput      += s.totalInput;
    p.totalOutput     += s.totalOutput;
    p.totalCacheWrite += s.totalCacheWrite;
    p.totalCacheRead  += s.totalCacheRead;
    p.totalCost       += s.totalCost;
    p.sessionCount    += 1;
    p.messageCount    += s.messageCount;
    if (s.endTime > p.lastActive) p.lastActive = s.endTime;
    for (const model of s.models) {
      p.models[model] = (p.models[model] ?? 0) + 1;
    }
  }

  const totalCost       = sessions.reduce((a, s) => a + s.totalCost, 0);
  const totalInput      = sessions.reduce((a, s) => a + s.totalInput, 0);
  const totalOutput     = sessions.reduce((a, s) => a + s.totalOutput, 0);
  const totalCacheWrite = sessions.reduce((a, s) => a + s.totalCacheWrite, 0);
  const totalCacheRead  = sessions.reduce((a, s) => a + s.totalCacheRead, 0);
  const totalMessages   = sessions.reduce((a, s) => a + s.messageCount, 0);

  return {
    sessions: sessions.sort((a, b) => b.startTime.localeCompare(a.startTime)),
    daily,
    projects: [...projectMap.values()].sort((a, b) => b.totalCost - a.totalCost),
    totalCost,
    totalInput,
    totalOutput,
    totalCacheWrite,
    totalCacheRead,
    totalSessions: sessions.length,
    totalMessages,
    parseErrors,
    lastUpdated: new Date().toISOString(),
  };
}
