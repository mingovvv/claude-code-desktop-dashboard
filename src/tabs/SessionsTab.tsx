import React, { useState, useMemo } from 'react';
import type { AggregatedStats, SessionStats } from '../types';
import { fmtTokens } from '../utils';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  stats: AggregatedStats | null;
}

type SortKey = 'startTime' | 'totalCost' | 'messageCount';

export default function SessionsTab({ stats }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('startTime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<SessionStats | null>(null);

  const sessions = useMemo(() => {
    if (!stats) return [];
    let s = stats.sessions.filter(
      (ss) =>
        ss.projectName.toLowerCase().includes(search.toLowerCase()) ||
        ss.sessionId.toLowerCase().includes(search.toLowerCase()),
    );
    s.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'startTime') cmp = a.startTime.localeCompare(b.startTime);
      else if (sortKey === 'totalCost') cmp = a.totalCost - b.totalCost;
      else cmp = a.messageCount - b.messageCount;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return s;
  }, [stats, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
    ) : null;

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="flex w-full flex-col overflow-hidden">
        <div className="p-6 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-white">세션</h1>
            <span className="text-xs text-slate-500">{sessions.length}개</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="프로젝트명 또는 세션 ID 검색..."
              className="w-full rounded-lg bg-slate-800 border border-slate-700 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {/* Table header */}
        <div className="px-6 grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 py-2 text-xs text-slate-500 border-b border-slate-700/50">
          <button onClick={() => toggleSort('startTime')} className="flex items-center gap-1 text-left">
            시작 시간 <SortIcon k="startTime" />
          </button>
          <span>프로젝트</span>
          <button onClick={() => toggleSort('messageCount')} className="flex items-center gap-1">
            메시지 <SortIcon k="messageCount" />
          </button>
          <button onClick={() => toggleSort('totalCost')} className="flex items-center gap-1 justify-end">
            비용 <SortIcon k="totalCost" />
          </button>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-6">
          {sessions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {search ? '검색 결과 없음' : '세션 데이터 없음'}
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.sessionId}
                onClick={() => setSelected(selected?.sessionId === s.sessionId ? null : s)}
                className={`w-full py-3 border-b border-slate-700/30 text-sm hover:bg-slate-800/50 transition-colors text-left px-2 -mx-2 rounded ${
                  selected?.sessionId === s.sessionId ? 'bg-slate-800' : ''
                }`}
              >
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 items-center">
                  <span className="text-slate-400 text-xs">
                    {new Date(s.startTime).toLocaleString('ko-KR')}
                  </span>
                  <span className="text-slate-200 truncate">{s.projectName}</span>
                  <span className="text-slate-400 text-center">{s.messageCount}</span>
                  <span className="text-emerald-400 font-mono text-right">${s.totalCost.toFixed(4)}</span>
                </div>
                {s.firstUserMessage && (
                  <div className="mt-1 text-xs text-slate-500 truncate pl-0.5">
                    {s.firstUserMessage}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 shrink-0 border-l border-slate-700/50 p-5 overflow-y-auto space-y-4">
          {/* Header */}
          <div>
            <h2 className="text-sm font-semibold text-white">{selected.projectName}</h2>
            <p className="text-xs text-slate-600 mt-0.5 break-all">{selected.sessionId}</p>
            <div className="flex gap-3 mt-1 text-xs text-slate-500">
              <span>{new Date(selected.startTime).toLocaleString('ko-KR')}</span>
            </div>
          </div>

          {/* First message */}
          {selected.firstUserMessage ? (
            <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3">
              <div className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                첫 번째 질문
              </div>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                {selected.firstUserMessage}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 p-3">
              <p className="text-xs text-slate-600 italic">질문 내용을 불러올 수 없습니다</p>
            </div>
          )}

          {/* Token breakdown */}
          <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 space-y-2">
            <div className="text-xs text-slate-400 mb-2">토큰 사용량</div>
            {[
              { label: '입력 (질문·컨텍스트)', value: selected.totalInput, color: 'bg-blue-500' },
              { label: '출력 (응답)', value: selected.totalOutput, color: 'bg-emerald-500' },
              { label: '캐시 쓰기', value: selected.totalCacheWrite, color: 'bg-violet-500' },
              { label: '캐시 읽기', value: selected.totalCacheRead, color: 'bg-amber-500' },
            ].map(({ label, value, color }) => {
              const total = selected.totalInput + selected.totalOutput + selected.totalCacheWrite + selected.totalCacheRead;
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-slate-300 font-mono">{fmtTokens(value)}</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-slate-700">
                    <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cost + stats */}
          <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">총 비용</span>
              <span className="text-emerald-400 font-mono font-semibold">${selected.totalCost.toFixed(6)}</span>
            </div>
            {[
              ['메시지 수', `${selected.userMessageCount}문 / ${selected.messageCount - selected.userMessageCount}답`],
              ['도구 호출', `${selected.toolCallCount}회`],
              ['모델', selected.models[0] ?? '알 수 없음'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-300 text-right max-w-[55%] break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Cache hit rate */}
          {selected.totalInput + selected.totalCacheRead > 0 && (
            <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3">
              <div className="text-xs text-slate-400 mb-1">캐시 히트율</div>
              <div className="text-lg font-bold text-blue-400">
                {((selected.totalCacheRead / (selected.totalInput + selected.totalCacheRead)) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                캐시 읽기 {fmtTokens(selected.totalCacheRead)} / 전체 입력 {fmtTokens(selected.totalInput + selected.totalCacheRead)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
