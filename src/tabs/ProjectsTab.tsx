import React, { useState } from 'react';
import type { AggregatedStats, ProjectStats } from '../types';
import { fmtTokens } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  stats: AggregatedStats | null;
}

export default function ProjectsTab({ stats }: Props) {
  const [selected, setSelected] = useState<ProjectStats | null>(null);

  if (!stats) return <div className="p-6 text-slate-400">데이터 없음</div>;

  const chartData = stats.projects.slice(0, 10).map((p) => ({
    name: p.projectName.length > 12 ? p.projectName.slice(0, 12) + '…' : p.projectName,
    cost: +p.totalCost.toFixed(4),
  }));

  const topModel = (p: ProjectStats) => {
    const entries = Object.entries(p.models);
    if (entries.length === 0) return '알 수 없음';
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">프로젝트</h1>
        <span className="text-xs text-slate-500">{stats.projects.length}개 프로젝트</span>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-4">프로젝트별 비용 (상위 10개)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [`$${v.toFixed(4)}`, '비용']}
              />
              <Bar dataKey="cost" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Project cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.projects.map((p) => (
          <button
            key={p.projectPath}
            onClick={() => setSelected(selected?.projectPath === p.projectPath ? null : p)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selected?.projectPath === p.projectPath
                ? 'border-slate-500 bg-slate-800'
                : 'border-slate-700/50 bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-medium text-white truncate max-w-[70%]">
                {p.projectName}
              </span>
              <span className="text-sm font-mono text-emerald-400">${p.totalCost.toFixed(3)}</span>
            </div>
            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>세션</span><span className="text-slate-400">{p.sessionCount}</span>
              </div>
              <div className="flex justify-between">
                <span>메시지</span><span className="text-slate-400">{p.messageCount}</span>
              </div>
              <div className="flex justify-between">
                <span>토큰</span>
                <span className="text-slate-400">
                  {fmtTokens(p.totalInput + p.totalOutput)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>최근 활동</span>
                <span className="text-slate-400">
                  {p.lastActive ? new Date(p.lastActive).toLocaleDateString('ko-KR') : '-'}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="rounded-xl bg-slate-800 border border-slate-600 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">{selected.projectName} 상세</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['총 비용', `$${selected.totalCost.toFixed(6)}`],
              ['입력 토큰', fmtTokens(selected.totalInput)],
              ['출력 토큰', fmtTokens(selected.totalOutput)],
              ['캐시 히트율',
                selected.totalInput + selected.totalCacheRead > 0
                  ? `${((selected.totalCacheRead / (selected.totalInput + selected.totalCacheRead)) * 100).toFixed(1)}%`
                  : '0%',
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-900/50 p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-base font-semibold text-white mt-1">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="text-xs text-slate-500 mb-1">주 사용 모델</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(selected.models)
                .sort((a, b) => b[1] - a[1])
                .map(([model, cnt]) => (
                  <span
                    key={model}
                    className="rounded-full bg-slate-700/50 border border-slate-600/50 px-2.5 py-0.5 text-xs text-slate-300"
                  >
                    {model} ({cnt})
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
