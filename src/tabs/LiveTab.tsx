import React, { useEffect, useState } from 'react';
import type { ActiveSession } from '../types';
import { fmtTokens } from '../utils';
import { Activity, Clock, Zap, DollarSign } from 'lucide-react';

interface Props {
  activeSessions: ActiveSession[];
}

function timeAgo(isoStr: string): string {
  const ms = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  return `${h}시간 전`;
}

export default function LiveTab({ activeSessions }: Props) {
  const [tick, setTick] = useState(0);

  // Re-render every 10s to update "time ago"
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const active = activeSessions.filter((s) => !s.isIdle);
  const idle   = activeSessions.filter((s) => s.isIdle);

  const totalBurnRate = active.reduce((a, s) => a + s.burnRatePerMin, 0);
  const totalCost     = activeSessions.reduce((a, s) => a + s.currentCost, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">라이브 모니터</h1>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          실시간
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-400">활성 세션</span>
          </div>
          <div className="text-2xl font-bold text-white">{active.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">유휴 {idle.length}개 포함</div>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-amber-400" />
            <span className="text-xs text-slate-400">현재 소모율</span>
          </div>
          <div className="text-2xl font-bold text-white">
            ${totalBurnRate.toFixed(4)}
            <span className="text-sm text-slate-400 font-normal">/분</span>
          </div>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-400">활성 세션 총액</span>
          </div>
          <div className="text-2xl font-bold text-white">${totalCost.toFixed(4)}</div>
        </div>
      </div>

      {activeSessions.length === 0 ? (
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-12 text-center">
          <Clock size={32} className="mx-auto text-slate-600 mb-3" />
          <div className="text-slate-400 text-sm">현재 활성 Claude Code 세션이 없습니다</div>
          <div className="text-slate-600 text-xs mt-1">Claude Code를 사용하면 여기에 실시간으로 표시됩니다</div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeSessions.map((s) => (
            <div
              key={s.sessionId}
              className={`rounded-xl border p-4 ${
                s.isIdle
                  ? 'border-slate-700/50 bg-slate-800/50'
                  : 'border-emerald-700/40 bg-slate-800'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        s.isIdle ? 'bg-amber-500' : 'bg-emerald-400 animate-pulse'
                      }`}
                    />
                    <span className="text-sm font-medium text-white">{s.projectName}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        s.isIdle
                          ? 'bg-amber-900/50 text-amber-400'
                          : 'bg-emerald-900/50 text-emerald-400'
                      }`}
                    >
                      {s.isIdle ? '유휴' : '활성'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    마지막 활동: {timeAgo(s.lastMessageTime)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    ${s.currentCost.toFixed(4)}
                  </div>
                  {!s.isIdle && s.burnRatePerMin > 0 && (
                    <div className="text-xs text-amber-400">
                      ${s.burnRatePerMin.toFixed(4)}/분
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[
                  ['입력', fmtTokens(s.currentInput)],
                  ['출력', fmtTokens(s.currentOutput)],
                  ['캐시 쓰기', fmtTokens(s.currentCacheWrite)],
                  ['메시지', String(s.messageCount)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded bg-slate-900/50 px-2 py-1.5">
                    <div className="text-slate-500">{label}</div>
                    <div className="text-slate-300 font-mono mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
