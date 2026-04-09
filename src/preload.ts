import { contextBridge, ipcRenderer } from 'electron';
import type { AggregatedStats, ActiveSession, AppSettings, CsvExportRequest, CsvExportResult } from './types';

contextBridge.exposeInMainWorld('api', {
  getStats: (): Promise<AggregatedStats> => ipcRenderer.invoke('get-stats'),
  refreshStats: (): Promise<AggregatedStats> => ipcRenderer.invoke('refresh-stats'),
  getActiveSessions: (): Promise<ActiveSession[]> => ipcRenderer.invoke('get-active-sessions'),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (s: AppSettings): Promise<AppSettings> => ipcRenderer.invoke('save-settings', s),
  getMonthCost: (): Promise<number> => ipcRenderer.invoke('get-month-cost'),
  openClaudeDir: (): Promise<void> => ipcRenderer.invoke('open-claude-dir'),
  exportCsv: (req: CsvExportRequest): Promise<CsvExportResult> => ipcRenderer.invoke('export-csv', req),

  onStatsUpdated: (cb: (stats: AggregatedStats) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, stats: AggregatedStats) => cb(stats);
    ipcRenderer.on('stats-updated', handler);
    return () => ipcRenderer.removeListener('stats-updated', handler);
  },
  onActiveSessionsUpdated: (cb: (sessions: ActiveSession[]) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, sessions: ActiveSession[]) => cb(sessions);
    ipcRenderer.on('active-sessions-updated', handler);
    return () => ipcRenderer.removeListener('active-sessions-updated', handler);
  },
});
