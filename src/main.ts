import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import started from 'electron-squirrel-startup';
import chokidar, { FSWatcher } from 'chokidar';
import type { AggregatedStats, AppSettings } from './types';
import { aggregateStats } from './lib/aggregator';
import {
  getActiveSessions,
  getCurrentMonthCost,
  checkBudgetAlerts,
  checkSessionEnds,
} from './lib/sessions';
import { setupIPC } from './lib/ipc';

if (started) app.quit();

// ─── Constants ───────────────────────────────────────────────────────────────
const CLAUDE_DIR       = path.join(os.homedir(), '.claude', 'projects');
const CONFIG_PATH      = path.join(app.getPath('userData'), 'settings.json');
const STATS_CACHE_PATH = path.join(app.getPath('userData'), 'stats-cache.json');
const CACHE_MAX_AGE_MS       = 60 * 60 * 1000;  // 1 hour
const DEFAULT_SESSION_TIMEOUT_MIN = 30;

// ─── Default settings ────────────────────────────────────────────────────────
const defaultSettings: AppSettings = {
  sessionEndTimeoutMin: DEFAULT_SESSION_TIMEOUT_MIN,
  budget: {
    monthlyBudget: 0,
    alertAt80: true,
    alertAt100: true,
    alert80Sent: false,
    alert100Sent: false,
    alertResetMonth: '',
  },
};

// ─── Settings persistence ────────────────────────────────────────────────────
function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const saved = JSON.parse(raw);
    return {
      ...defaultSettings,
      ...saved,
      budget: { ...defaultSettings.budget, ...(saved.budget ?? {}) },
    };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettingsToDisk(s: AppSettings): void {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(s, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// ─── Stats cache ─────────────────────────────────────────────────────────────
interface StatsCache {
  lastAggregated: string;
  stats: AggregatedStats;
}

function loadStatsCache(): AggregatedStats | null {
  try {
    const raw = fs.readFileSync(STATS_CACHE_PATH, 'utf-8');
    const cache: StatsCache = JSON.parse(raw);
    const age = Date.now() - new Date(cache.lastAggregated).getTime();
    if (age < CACHE_MAX_AGE_MS) {
      console.log(`[cache] loaded (age ${Math.round(age / 60000)}min)`);
      return cache.stats;
    }
    console.log(`[cache] stale (age ${Math.round(age / 60000)}min), will reparse`);
  } catch {
    // no cache or corrupt — full parse needed
  }
  return null;
}

function saveStatsCache(stats: AggregatedStats): void {
  try {
    const cache: StatsCache = { lastAggregated: new Date().toISOString(), stats };
    fs.writeFileSync(STATS_CACHE_PATH, JSON.stringify(cache));
  } catch (e) {
    console.error('[cache] failed to save:', e);
  }
}

// ─── App state ───────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let watcher: FSWatcher | null = null;
let cachedStats: AggregatedStats | null = null;
let settings: AppSettings = loadSettings();
let updateTimer: ReturnType<typeof setInterval> | null = null;

function getSessionEndMs(): number {
  return (settings.sessionEndTimeoutMin ?? DEFAULT_SESSION_TIMEOUT_MIN) * 60 * 1000;
}

// ─── Tray ────────────────────────────────────────────────────────────────────
const TRAY_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADGSURBVDiNpdOxDcMgEAXQS5xBGmXIBB6BJVzSpcgGHiNbZJcMwAqW5OkobqRgcUJ+6UBCevdAcKWU0gkhBEIIAL/pMeb5CiGAiDinlE4ppStHSmkJIYQXADPvzrkXY8w5pXSDiDwBqDFG51rXGOM5hPA1xlxr7bHWOkopxRgz5JyvtdYLAFBVVVVVVVWklFYAkFJSVVWF53lpAFJKSykVAKTUWusJAEJKqakqQEgpRURVVUREVVVVREqpJaWqKiCEAABgjHFKqSql1F+AAAB//2Q=';

function updateTrayTitle(): void {
  if (!tray) return;
  const monthCost = getCurrentMonthCost(cachedStats);
  const totalCost = cachedStats?.totalCost ?? 0;
  tray.setToolTip(`Claude Code Dashboard\n이번 달: $${monthCost.toFixed(3)}\n총: $${totalCost.toFixed(3)}`);
  tray.setTitle(`$${monthCost.toFixed(2)}`);
}

async function updateTrayMenu(): Promise<void> {
  if (!tray) return;
  const monthCost = getCurrentMonthCost(cachedStats);
  let activeSessions: Awaited<ReturnType<typeof getActiveSessions>> = [];
  try {
    activeSessions = await getActiveSessions(CLAUDE_DIR, getSessionEndMs(), cachedStats);
  } catch {
    // tray still updates with empty sessions on error
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: `이번 달: $${monthCost.toFixed(4)}`, enabled: false },
    { label: `활성 세션: ${activeSessions.filter((s) => !s.isIdle).length}개`, enabled: false },
    { type: 'separator' },
    {
      label: '대시보드 열기',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.focus();
      else mainWindow.show();
    } else {
      createWindow();
    }
  });
}

function createTray(): void {
  let icon = nativeImage.createEmpty();
  try {
    const fromData = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
    if (!fromData.isEmpty()) icon = fromData;
  } catch {
    // keep empty icon as fallback
  }

  try {
    tray = new Tray(icon);
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }

  updateTrayTitle();
  updateTrayMenu();
}

// ─── File watcher ────────────────────────────────────────────────────────────
function startWatcher(): void {
  if (!fs.existsSync(CLAUDE_DIR)) return;

  watcher = chokidar.watch(CLAUDE_DIR, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
  });

  const onFileChange = async () => {
    cachedStats = await aggregateStats(CLAUDE_DIR);
    updateTrayTitle();
    void updateTrayMenu();
    checkBudgetAlerts(settings, cachedStats, saveSettingsToDisk);
    await checkSessionEnds(CLAUDE_DIR, getSessionEndMs(), cachedStats, () => {
      if (cachedStats) saveStatsCache(cachedStats);
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stats-updated', cachedStats);
      mainWindow.webContents.send(
        'active-sessions-updated',
        await getActiveSessions(CLAUDE_DIR, getSessionEndMs(), cachedStats),
      );
    }
  };

  watcher.on('add', onFileChange);
  watcher.on('change', onFileChange);
  watcher.on('unlink', onFileChange);
}

// ─── BrowserWindow ───────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('close', (e) => {
    if (tray && !(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.on('ready', async () => {
  setupIPC({
    claudeDir: CLAUDE_DIR,
    getSessionEndMs,
    getCachedStats: () => cachedStats,
    setCachedStats: (s) => { cachedStats = s; },
    saveStatsCache,
    getSettings: () => settings,
    saveSettings: (s) => { settings = { ...s }; saveSettingsToDisk(settings); },
    updateTrayTitle,
    updateTrayMenu,
    checkBudgetAlerts: () => checkBudgetAlerts(settings, cachedStats, saveSettingsToDisk),
    getMainWindow: () => mainWindow,
  });

  createWindow();

  // Initial stats load — try cache first, fall back to full parse
  cachedStats = loadStatsCache();
  if (!cachedStats) {
    cachedStats = await aggregateStats(CLAUDE_DIR);
    saveStatsCache(cachedStats);
  }

  createTray();
  startWatcher();

  // Periodic session end detection + live refresh (every 30s)
  updateTimer = setInterval(() => {
    void (async () => {
      await checkSessionEnds(CLAUDE_DIR, getSessionEndMs(), cachedStats, () => {
        if (cachedStats) saveStatsCache(cachedStats);
      });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          'active-sessions-updated',
          await getActiveSessions(CLAUDE_DIR, getSessionEndMs(), cachedStats),
        );
      }
    })();
  }, 30_000);
});

app.on('window-all-closed', () => {
  // Don't quit — live in tray
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  watcher?.close();
  if (updateTimer) clearInterval(updateTimer);
});
