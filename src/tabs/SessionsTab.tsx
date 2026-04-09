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
                className={`w-full grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 items-center py-3 border-b border-slate-700/30 text-sm hover:bg-slate-800/50 transition-colors ${
                  selected?.sessionId === s.sessionId ? 'bg-slate-800' : ''
                }`}
              >
                <span className="text-slate-400 text-xs text-left">
                  {new Date(s.startTime).toLocaleString('ko-KR')}
                </span>
                <span className="text-slate-200 truncate text-left">{s.projectName}</span>
                <span className="text-slate-400">{s.messageCount}</span>
                <span className="text-emerald-400 font-mono text-right">${s.totalCost.toFixed(4)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 shrink-0 border-l border-slate-700/50 p-5 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">{selected.projectName}</h2>
            <p className="text-xs text-slate-500 mt-1 break-all">{selected.sessionId}</p>
          </div>
          <div className="space-y-3">
            {[
              ['비용', `$${selected.totalCost.toFixed(6)}`],
              ['입력 토큰', fmtTokens(selected.totalInput)],
              ['출력 토큰', fmtTokens(selected.totalOutput)],
              ['캐시 쓰기', fmtTokens(selected.totalCacheWrite)],
              ['캐시 읽기', fmtTokens(selected.totalCacheRead)],
              ['메시지', String(selected.messageCount)],
              ['사용자 메시지', String(selected.userMessageCount)],
              ['도구 호출', String(selected.toolCallCount)],
              ['시작', new Date(selected.startTime).toLocaleString('ko-KR')],
              ['종료', new Date(selected.endTime).toLocaleString('ko-KR')],
              ['모델', selected.models.join(', ') || '알 수 없음'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-200 text-right max-w-[55%] break-all">{value}</span>
              </div>
            ))}
          </div>
          {selected.totalInput + selected.totalCacheRead > 0 && (
            <div className="mt-4 rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400 mb-1">캐시 히트율</div>
              <div className="text-lg font-bold text-blue-400">
                {((selected.totalCacheRead / (selected.totalInput + selected.totalCacheRead)) * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
