import React, { useState } from 'react';
import type { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => Promise<void>;
}

export default function SettingsTab({ settings, onSave }: Props) {
  const [form, setForm] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-white">설정</h1>

      {/* Session timeout */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4 space-y-3">
        <h2 className="text-sm font-medium text-slate-200">세션 종료 타임아웃</h2>
        <p className="text-xs text-slate-500">파일 마지막 수정 후 이 시간이 지나면 세션이 종료된 것으로 간주합니다</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={5}
            max={120}
            value={form.sessionEndTimeoutMin}
            onChange={(e) =>
              setForm((f) => ({ ...f, sessionEndTimeoutMin: Number(e.target.value) }))
            }
            className="w-20 rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white outline-none focus:border-slate-500"
          />
          <span className="text-sm text-slate-400">분</span>
        </div>
      </div>

      {/* Budget */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-4 space-y-4">
        <h2 className="text-sm font-medium text-slate-200">월 예산 설정</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-300">월 예산 (USD)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">$</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.budget.monthlyBudget}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    budget: { ...f.budget, monthlyBudget: Number(e.target.value) },
                  }))
                }
                placeholder="0 = 비활성"
                className="w-28 rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {form.budget.monthlyBudget > 0 && (
            <>
              {[
                { key: 'alertAt80' as const, label: '80% 도달 시 알림' },
                { key: 'alertAt100' as const, label: '100% 초과 시 알림' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm text-slate-300">{label}</label>
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        budget: { ...f.budget, [key]: !f.budget[key] },
                      }))
                    }
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                      form.budget[key] ? 'bg-slate-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        form.budget[key] ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
          saved
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-600 text-white hover:bg-slate-500'
        }`}
      >
        {saved ? '저장 완료!' : '설정 저장'}
      </button>
    </div>
  );
}
