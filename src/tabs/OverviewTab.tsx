import React from 'react';
import type { AggregatedStats } from '../types';
import { fmtTokens } from '../utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { DollarSign, Cpu, Database, Zap, AlertTriangle, FolderOpen } from 'lucide-react';

interface Props {
  stats: AggregatedStats | null;
  monthCost: number;
  lastMonthCost: number;
}

function StatCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
      <div className="text-slate-400">{icon}</div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-slate-400 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function OverviewTab({ stats, monthCost, lastMonthCost }: Props) {
  if (!stats || (stats.totalSessions === 0 && stats.parseErrors === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <FolderOpen size={40} className="text-slate-600 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-1">데이터 없음</h2>
        <p className="text-sm text-slate-400 mb-4 max-w-xs">
          Claude Code를 사용하면 사용량이 여기에 표시됩니다.<br />
          <span className="text-slate-500">~/.claude/projects/ 폴더를 확인하세요.</span>
        </p>
        <button
          onClick={() => window.api.openClaudeDir()}
          className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 transition-colors"
        >
          <FolderOpen size={14} />
          .claude 폴더 열기
        </button>
      </div>
    );
  }

  const totalTokens = stats.totalInput + stats.totalOutput + stats.totalCacheWrite + stats.totalCacheRead;
  const cacheHitRate =
    stats.totalCacheRead + stats.totalInput > 0
      ? stats.totalCacheRead / (stats.totalInput + stats.totalCacheRead)
      : 0;

  const chartData = stats.daily.slice(-30).map((d) => ({
    date: d.date.slice(5),
    cost: +d.totalCost.toFixed(4),
    messages: d.messageCount,
    sessions: d.sessionCount,
  }));

  const topProjects = stats.projects.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">개요</h1>
        <span className="text-xs text-slate-500">
          마지막 업데이트: {new Date(stats.lastUpdated).toLocaleTimeString('ko-KR')}
        </span>
      </div>

      {/* Parse error banner */}
      {stats.parseErrors > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            JSONL 파싱 오류 {stats.parseErrors}건 — 일부 세션 데이터가 누락됐을 수 있습니다.
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          icon={<DollarSign size={16} />}
          label="이번 달 비용"
          value={`$${monthCost.toFixed(4)}`}
          sub={
            lastMonthCost > 0
              ? (() => {
                  const delta = ((monthCost - lastMonthCost) / lastMonthCost) * 100;
                  return `전달 대비 ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
                })()
              : `총 $${stats.totalCost.toFixed(4)}`
          }
        />
        <StatCard
          icon={<Cpu size={16} />}
          label="총 토큰"
          value={fmtTokens(totalTokens)}
          sub={`입력 ${fmtTokens(stats.totalInput)} / 출력 ${fmtTokens(stats.totalOutput)}`}
        />
        <StatCard
          icon={<Database size={16} />}
          label="캐시 히트율"
          value={`${(cacheHitRate * 100).toFixed(1)}%`}
          sub={`읽기 ${fmtTokens(stats.totalCacheRead)} 토큰`}
        />
        <StatCard
          icon={<Zap size={16} />}
          label="총 세션"
          value={String(stats.totalSessions)}
          sub={`메시지 ${stats.totalMessages.toLocaleString()}개`}
        />
      </div>

      {/* Daily cost chart */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
        <h2 className="text-sm font-medium text-slate-300 mb-4">일별 비용 (최근 30일)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => [`$${v.toFixed(4)}`, '비용']}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#7c3aed"
                fill="url(#costGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-slate-500 text-sm">
            데이터 없음 — Claude Code를 사용하면 여기에 표시됩니다
          </div>
        )}
      </div>

      {/* Top projects */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
        <h2 className="text-sm font-medium text-slate-300 mb-3">상위 프로젝트</h2>
        {topProjects.length === 0 ? (
          <div className="text-slate-500 text-sm">프로젝트 없음</div>
        ) : (
          <div className="space-y-2">
            {topProjects.map((p) => {
              const pct = stats.totalCost > 0 ? (p.totalCost / stats.totalCost) * 100 : 0;
              return (
                <div key={p.projectPath}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-300 truncate max-w-[60%]">{p.projectName}</span>
                    <span className="text-slate-400">${p.totalCost.toFixed(4)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-700">
                    <div
                      className="h-1.5 rounded-full bg-violet-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent sessions */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
        <h2 className="text-sm font-medium text-slate-300 mb-3">최근 세션</h2>
        {stats.sessions.length === 0 ? (
          <div className="text-slate-500 text-sm">세션 없음</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {stats.sessions.slice(0, 8).map((s) => (
              <div key={s.sessionId} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">{s.projectName}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(s.startTime).toLocaleString('ko-KR')} · {s.messageCount}개 메시지
                  </div>
                </div>
                <div className="text-sm font-mono text-emerald-400 ml-4 shrink-0">
                  ${s.totalCost.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
