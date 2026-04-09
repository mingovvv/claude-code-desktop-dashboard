import React, { useState, useEffect, useCallback } from 'react';
import type { AggregatedStats, ActiveSession, AppSettings, CsvExportRequest, CsvExportResult } from './types';
import OverviewTab from './tabs/OverviewTab';
import SessionsTab from './tabs/SessionsTab';
import ProjectsTab from './tabs/ProjectsTab';
import LiveTab from './tabs/LiveTab';
import ReportsTab from './tabs/ReportsTab';
import SettingsTab from './tabs/SettingsTab';
import {
  LayoutDashboard, Clock, FolderOpen, Zap,
  BarChart2, Settings, RefreshCw, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

type Tab = 'overview' | 'sessions' | 'projects' | 'live' | 'reports' | 'settings';

function monthPrefix(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function sumMonthCost(daily: AggregatedStats['daily'], prefix: string): number {
  return daily.filter((d) => d.date.startsWith(prefix)).reduce((a, d) => a + d.totalCost, 0);
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: '개요',        icon: <LayoutDashboard size={18} /> },
  { id: 'live',      label: '라이브',      icon: <Zap size={18} /> },
  { id: 'sessions',  label: '세션',        icon: <Clock size={18} /> },
  { id: 'projects',  label: '프로젝트',    icon: <FolderOpen size={18} /> },
  { id: 'reports',   label: '리포트',      icon: <BarChart2 size={18} /> },
  { id: 'settings',  label: '설정',        icon: <Settings size={18} /> },
];

declare global {
  interface Window {
    api: {
      getStats: () => Promise<AggregatedStats>;
      refreshStats: () => Promise<AggregatedStats>;
      getActiveSessions: () => Promise<ActiveSession[]>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (s: AppSettings) => Promise<AppSettings>;
      getMonthCost: () => Promise<number>;
      openClaudeDir: () => Promise<void>;
      exportCsv: (req: CsvExportRequest) => Promise<CsvExportResult>;
      onStatsUpdated: (cb: (stats: AggregatedStats) => void) => () => void;
      onActiveSessionsUpdated: (cb: (sessions: ActiveSession[]) => void) => () => void;
    };
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthCost, setMonthCost] = useState(0);
  const [lastMonthCost, setLastMonthCost] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [s, active, cfg, mc] = await Promise.all([
        window.api.getStats(),
        window.api.getActiveSessions(),
        window.api.getSettings(),
        window.api.getMonthCost(),
      ]);
      setStats(s);
      setActiveSessions(active);
      setAppSettings(cfg);
      setMonthCost(mc);
      setLastMonthCost(sumMonthCost(s.daily, monthPrefix(-1)));
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, active, mc] = await Promise.all([
        window.api.refreshStats(),
        window.api.getActiveSessions(),
        window.api.getMonthCost(),
      ]);
      setStats(s);
      setActiveSessions(active);
      setMonthCost(mc);
      setLastMonthCost(sumMonthCost(s.daily, monthPrefix(-1)));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const offStats = window.api.onStatsUpdated((s) => {
      setStats(s);
      setMonthCost(sumMonthCost(s.daily, monthPrefix()));
      setLastMonthCost(sumMonthCost(s.daily, monthPrefix(-1)));
    });
    const offActive = window.api.onActiveSessionsUpdated(setActiveSessions);

    return () => {
      offStats?.();
      offActive?.();
    };
  }, [loadData]);

  // 라이브 탭 활성 시 3초마다 active sessions 갱신
  useEffect(() => {
    if (tab !== 'live') return;
    const t = setInterval(async () => {
      const active = await window.api.getActiveSessions();
      setActiveSessions(active);
    }, 3_000);
    return () => clearInterval(t);
  }, [tab]);

  const handleSaveSettings = async (s: AppSettings) => {
    const saved = await window.api.saveSettings(s);
    setAppSettings(saved);
  };

  const activeCount = activeSessions.filter((s) => !s.isIdle).length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-400">
        <div className="text-center">
          <div className="mb-3 text-2xl font-semibold text-white">Claude Dashboard</div>
          <div className="text-sm">데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        aria-label="사이드바"
        className={`flex flex-col border-r border-slate-700/50 bg-slate-900 transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-14'}`}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center border-b border-slate-700/50 px-2 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white text-sm font-bold">
            CC
          </div>
          {sidebarOpen && (
            <div className="ml-2 min-w-0">
              <div className="text-sm font-semibold text-white leading-none">Claude</div>
              <div className="text-xs text-slate-400 leading-none mt-0.5">Dashboard</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? '사이드바 접기' : '사이드바 펼치기'}
            className="ml-auto rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        </div>

        {/* Monthly cost hero */}
        {sidebarOpen && (
          <div className="mx-3 mt-3 rounded-lg bg-slate-800 px-3 py-2.5 border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-0.5">이번 달 총 비용</div>
            <div className="text-xl font-bold text-emerald-400">${monthCost.toFixed(4)}</div>
            {lastMonthCost > 0 && (() => {
              const delta = ((monthCost - lastMonthCost) / lastMonthCost) * 100;
              const sign = delta >= 0 ? '+' : '';
              const color = delta > 0 ? 'text-red-400' : 'text-emerald-400';
              return (
                <div className={`mt-0.5 text-xs ${color}`}>
                  전달 대비 {sign}{delta.toFixed(1)}%
                </div>
              );
            })()}
            {activeCount > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                활성 {activeCount}개
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav aria-label="주요 탐색" className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-label={label}
              aria-current={tab === id ? 'page' : undefined}
              title={!sidebarOpen ? label : undefined}
              className={`w-full flex items-center rounded-md px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                sidebarOpen ? 'gap-2.5 px-3' : 'justify-center'
              } ${
                tab === id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {icon}
              {sidebarOpen && label}
              {sidebarOpen && id === 'live' && activeCount > 0 && (
                <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              )}
              {!sidebarOpen && id === 'live' && activeCount > 0 && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          ))}
        </nav>

        {/* Footer stats */}
        {sidebarOpen ? (
          <div className="border-t border-slate-700/50 px-3 py-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>총 세션</span>
              <span className="text-slate-300">{stats?.totalSessions ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>총 비용</span>
              <span className="text-slate-300">${stats?.totalCost.toFixed(3) ?? '0.000'}</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="데이터 새로고침"
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-700/50 px-2 py-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="데이터 새로고침"
              title="새로고침"
              className="w-full flex items-center justify-center rounded-md py-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'overview'  && <OverviewTab stats={stats} monthCost={monthCost} lastMonthCost={lastMonthCost} />}
        {tab === 'sessions'  && <SessionsTab stats={stats} />}
        {tab === 'projects'  && <ProjectsTab stats={stats} />}
        {tab === 'live'      && <LiveTab activeSessions={activeSessions} />}
        {tab === 'reports'   && <ReportsTab stats={stats} />}
        {tab === 'settings'  && appSettings && (
          <SettingsTab settings={appSettings} onSave={handleSaveSettings} />
        )}
      </main>
    </div>
  );
}
