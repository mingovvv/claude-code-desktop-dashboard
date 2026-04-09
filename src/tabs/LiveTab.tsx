import React, { useEffect, useState } from 'react';
import type { ActiveSession } from '../types';
import { fmtTokens } from '../utils';
import { Activity, Clock, Zap, DollarSign, MessageSquare } from 'lucide-react';

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
      {/* Header */}
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

      {/* Session list */}
      {activeSessions.length === 0 ? (
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-12 text-center">
          <Clock size={32} className="mx-auto text-slate-600 mb-3" />
          <div className="text-slate-400 text-sm">현재 활성 Claude Code 세션이 없습니다</div>
          <div className="text-slate-600 text-xs mt-1">Claude Code를 사용하면 여기에 실시간으로 표시됩니다</div>
        </div>
      ) : (
        <div className="space-y-4">
          {activeSessions.map((s) => (
            <div
              key={s.sessionId}
              className={`rounded-xl border overflow-hidden ${
                s.isIdle
                  ? 'border-slate-700/50 bg-slate-800/40'
                  : 'border-emerald-700/40 bg-slate-800'
              }`}
            >
              {/* Session header */}
              <div className="flex items-start justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 mt-0.5 ${
                      s.isIdle ? 'bg-amber-500' : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{s.projectName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
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
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    ${s.currentCost.toFixed(4)}
                  </div>
                  {!s.isIdle && s.burnRatePerMin > 0 && (
                    <div className="text-xs text-amber-400 mt-0.5">
                      ${s.burnRatePerMin.toFixed(4)}/분
                    </div>
                  )}
                </div>
              </div>

              {/* Token stats */}
              <div className="grid grid-cols-4 gap-2 px-4 pb-3">
                {[
                  ['입력', fmtTokens(s.currentInput)],
                  ['출력', fmtTokens(s.currentOutput)],
                  ['캐시 쓰기', fmtTokens(s.currentCacheWrite)],
                  ['메시지', String(s.messageCount)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-900/60 px-2.5 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
                    <div className="text-xs text-slate-300 font-mono">{value}</div>
                  </div>
                ))}
              </div>

              {/* Conversation messages */}
              {s.recentUserMessages.length > 0 && (
                <div className="border-t border-slate-700/40 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <MessageSquare size={11} className="text-slate-500" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">
                      대화 내역 ({s.recentUserMessages.length}개 질문)
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {s.recentUserMessages.map((msg, i) => (
                      <div key={i} className="flex gap-2.5 group">
                        <span className="text-[10px] text-slate-600 font-mono mt-0.5 shrink-0 w-4 text-right">
                          {i + 1}
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words flex-1">
                          {msg}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
