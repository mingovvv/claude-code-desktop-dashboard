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
import zlib from 'node:zlib';
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

// ─── Tray icon generation ─────────────────────────────────────────────────────
/** Build a minimal valid PNG from raw RGB pixels. Pure Node.js, no deps. */
function buildPNG(w: number, h: number, rgb: Buffer): Buffer {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[i] = c;
  }
  const crc32 = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = tbl[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const mkChunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type, 'ascii');
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0);
    const k = Buffer.alloc(4); k.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([l, t, data, k]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // bit depth 8, RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: None
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    mkChunk('IHDR', ihdr),
    mkChunk('IDAT', compressed),
    mkChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Generate a 32×32 "C" arc icon in violet on dark background. */
function createTrayIconImage(): Electron.NativeImage {
  const SIZE = 32;
  const BG: [number, number, number] = [15, 23, 42];    // #0f172a slate-900
  const FG: [number, number, number] = [167, 139, 250];  // #a78bfa violet-400

  const pixels = Buffer.alloc(SIZE * SIZE * 3);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = SIZE * 0.40;
  const innerR = outerR - SIZE * 0.20;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const inRing = dist >= innerR && dist <= outerR;
      const inArc  = Math.abs(angle) >= 50; // "C" gap on right side
      const color = (inRing && inArc) ? FG : BG;
      const idx = (y * SIZE + x) * 3;
      pixels[idx] = color[0]; pixels[idx + 1] = color[1]; pixels[idx + 2] = color[2];
    }
  }

  try {
    return nativeImage.createFromBuffer(buildPNG(SIZE, SIZE, pixels), { scaleFactor: 1 });
  } catch {
    return nativeImage.createEmpty();
  }
}

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
  const icon = createTrayIconImage();
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
