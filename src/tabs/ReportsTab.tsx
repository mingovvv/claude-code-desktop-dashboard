import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { AggregatedStats, CsvDateRange } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  stats: AggregatedStats | null;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export default function ReportsTab({ stats }: Props) {
  const [exporting, setExporting] = useState(false);
  const [csvDateRange, setCsvDateRange] = useState<CsvDateRange>('thisMonth');

  async function handleExport(type: 'sessions' | 'daily') {
    if (!stats || exporting) return;
    setExporting(true);
    try {
      await window.api.exportCsv({ type, dateRange: csvDateRange });
    } finally {
      setExporting(false);
    }
  }
  const weeklyData = useMemo(() => {
    if (!stats) return [];
    const map = new Map<string, { week: string; cost: number; messages: number; sessions: number }>();
    for (const d of stats.daily) {
      const date = new Date(d.date + 'T00:00:00');
      const week = getWeekStart(date);
      const label = `${week.slice(5).replace('-', '/')}`; // MM/DD
      if (!map.has(week)) {
        map.set(week, { week: label, cost: 0, messages: 0, sessions: 0 });
      }
      const w = map.get(week)!;
      w.cost     += d.totalCost;
      w.messages += d.messageCount;
      w.sessions += d.sessionCount;
    }
    return [...map.values()]
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-8)
      .map((w) => ({ ...w, cost: +w.cost.toFixed(4) }));
  }, [stats]);

  const thisMonth = useMemo(() => {
    if (!stats) return null;
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return stats.daily.filter((d) => d.date.startsWith(prefix));
  }, [stats]);

  const lastMonth = useMemo(() => {
    if (!stats) return null;
    const now = new Date();
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 12 : now.getMonth();
    const prefix = `${y}-${String(m).padStart(2, '0')}`;
    return stats.daily.filter((d) => d.date.startsWith(prefix));
  }, [stats]);

  const sum = (days: typeof thisMonth, key: 'totalCost' | 'messageCount' | 'sessionCount') =>
    (days ?? []).reduce((a, d) => a + (d[key] as number), 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">리포트</h1>

      {/* Month comparison */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: '이번 달', data: thisMonth },
          { label: '지난 달', data: lastMonth },
        ].map(({ label, data }) => (
          <div key={label} className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
            <div className="text-sm font-medium text-slate-300 mb-3">{label}</div>
            <div className="space-y-2">
              {[
                ['총 비용', `$${sum(data, 'totalCost').toFixed(4)}`],
                ['메시지', sum(data, 'messageCount').toLocaleString()],
                ['세션', sum(data, 'sessionCount').toLocaleString()],
                ['활동일', `${(data ?? []).filter((d) => d.totalCost > 0).length}일`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly bar chart */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
        <h2 className="text-sm font-medium text-slate-300 mb-4">주별 비용 (최근 8주)</h2>
        {weeklyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [`$${v.toFixed(4)}`, '비용']}
              />
              <Bar dataKey="cost" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[220px] items-center justify-center text-slate-500 text-sm">
            데이터 없음
          </div>
        )}
      </div>

      {/* CSV export */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
        <h2 className="text-sm font-medium text-slate-300 mb-3">CSV 내보내기</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={csvDateRange}
            onChange={(e) => setCsvDateRange(e.target.value as CsvDateRange)}
            className="rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm px-3 py-1.5 focus:outline-none focus:border-slate-500"
          >
            <option value="thisMonth">이번 달</option>
            <option value="last3Months">최근 3개월</option>
            <option value="all">전체</option>
          </select>
          <button
            onClick={() => handleExport('sessions')}
            disabled={!stats || exporting}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm px-3 py-1.5 transition-colors"
          >
            <Download size={14} />
            세션 목록
          </button>
          <button
            onClick={() => handleExport('daily')}
            disabled={!stats || exporting}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm px-3 py-1.5 transition-colors"
          >
            <Download size={14} />
            일별 집계
          </button>
        </div>
      </div>

      {/* Top usage days */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
        <h2 className="text-sm font-medium text-slate-300 mb-3">사용량 TOP 10 (일별)</h2>
        {!stats || stats.daily.length === 0 ? (
          <div className="text-slate-500 text-sm">데이터 없음</div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {[...stats.daily]
              .sort((a, b) => b.totalCost - a.totalCost)
              .slice(0, 10)
              .map((d) => (
                <div key={d.date} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-slate-400">{d.date}</span>
                  <div className="flex items-center gap-6 text-xs text-slate-500">
                    <span>{d.sessionCount}세션</span>
                    <span>{d.messageCount}메시지</span>
                    <span className="text-emerald-400 font-mono">${d.totalCost.toFixed(4)}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
