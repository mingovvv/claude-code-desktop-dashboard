import { ipcMain, shell, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import type { AggregatedStats, AppSettings, CsvExportRequest, CsvExportResult } from '../types';
import { aggregateStats } from './aggregator';
import { getActiveSessions, getCurrentMonthCost } from './sessions';

export interface IpcContext {
  claudeDir: string;
  getSessionEndMs: () => number;
  getCachedStats: () => AggregatedStats | null;
  setCachedStats: (s: AggregatedStats) => void;
  saveStatsCache: (s: AggregatedStats) => void;
  getSettings: () => AppSettings;
  saveSettings: (s: AppSettings) => void;
  updateTrayTitle: () => void;
  updateTrayMenu: () => void;
  checkBudgetAlerts: () => void;
  getMainWindow: () => BrowserWindow | null;
}

export function setupIPC(ctx: IpcContext): void {
  ipcMain.handle('get-stats', async () => {
    if (!ctx.getCachedStats()) {
      ctx.setCachedStats(await aggregateStats(ctx.claudeDir));
    }
    return ctx.getCachedStats();
  });

  ipcMain.handle('refresh-stats', async () => {
    const stats = await aggregateStats(ctx.claudeDir);
    ctx.setCachedStats(stats);
    ctx.saveStatsCache(stats);
    ctx.updateTrayTitle();
    ctx.updateTrayMenu();
    ctx.checkBudgetAlerts();
    return stats;
  });

  ipcMain.handle('get-active-sessions', () => {
    return getActiveSessions(ctx.claudeDir, ctx.getSessionEndMs(), ctx.getCachedStats());
  }); // getActiveSessions is now async — ipcMain.handle auto-awaits the returned Promise

  ipcMain.handle('get-settings', () => {
    return ctx.getSettings();
  });

  ipcMain.handle('save-settings', (_event, newSettings: AppSettings) => {
    ctx.saveSettings(newSettings);
    ctx.updateTrayMenu();
    return ctx.getSettings();
  });

  ipcMain.handle('get-month-cost', () => {
    return getCurrentMonthCost(ctx.getCachedStats());
  });

  ipcMain.handle('open-claude-dir', () => {
    shell.openPath(ctx.claudeDir);
  });

  ipcMain.handle('export-csv', async (_event, req: CsvExportRequest): Promise<CsvExportResult> => {
    const stats = ctx.getCachedStats();
    if (!stats) return { cancelled: true };

    const now = new Date();
    const csvContent = buildCsv(req, stats, now);

    const defaultName = req.type === 'sessions'
      ? `claude-sessions-${now.toISOString().slice(0, 10)}.csv`
      : `claude-daily-${now.toISOString().slice(0, 10)}.csv`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (canceled || !filePath) return { cancelled: true };

    await fs.promises.writeFile(filePath, csvContent, 'utf-8');
    return { cancelled: false, filePath };
  });
}

function getDateFilter(dateRange: CsvExportRequest['dateRange'], now: Date): (date: string) => boolean {
  if (dateRange === 'all') return () => true;
  if (dateRange === 'thisMonth') {
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return (date: string) => date.startsWith(prefix);
  }
  // last3Months
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return (date: string) => date >= cutoffStr;
}

function buildCsv(req: CsvExportRequest, stats: AggregatedStats, now: Date): string {
  const filter = getDateFilter(req.dateRange, now);

  if (req.type === 'sessions') {
    const rows = stats.sessions.filter((s) => filter(s.startTime.slice(0, 10)));
    const header = 'date,project,input_tokens,output_tokens,cache_write,cache_read,cost_usd,messages';
    const lines = rows.map((s) =>
      [
        s.startTime.slice(0, 10),
        `"${s.projectName.replace(/"/g, '""')}"`,
        s.totalInput,
        s.totalOutput,
        s.totalCacheWrite,
        s.totalCacheRead,
        s.totalCost.toFixed(6),
        s.messageCount,
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  // daily
  const rows = stats.daily.filter((d) => filter(d.date));
  const header = 'date,sessions,messages,input_tokens,output_tokens,cache_write,cache_read,cost_usd';
  const lines = rows.map((d) =>
    [
      d.date,
      d.sessionCount,
      d.messageCount,
      d.totalInput,
      d.totalOutput,
      d.totalCacheWrite,
      d.totalCacheRead,
      d.totalCost.toFixed(6),
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
