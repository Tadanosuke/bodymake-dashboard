"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, CheckCircle2, Dumbbell, Footprints, Pencil,
  RefreshCw, Scale, Send, Sparkles, Utensils,
} from "lucide-react";
import { getDailyLog, saveDailyLog } from "@/lib/firestore";
import { useCurrentUser } from "./AuthGate";
import type { DashboardData } from "@/lib/types";

interface Props {
  onSubmit: () => void;
  gasEndpoint?: string;
  data?: DashboardData | null;
  onRefresh?: () => void;
}

function todayKey() {
  return new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
      ok
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    }`}>
      {ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
      {label}
    </span>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e2d40] bg-[#0f1a2b] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className={`text-sm font-semibold ${value ? 'text-slate-100' : 'text-slate-600'}`}>
        {value || '未反映'}
      </p>
    </div>
  );
}

export default function QuickInput({ onSubmit, gasEndpoint = '', data, onRefresh }: Props) {
  const currentUser = useCurrentUser();
  const uid = currentUser?.uid ?? '';
  const today = todayKey();

  const [weight, setWeight] = useState('');
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const sync = data?.morningSync;
  const todayLog = data?.logs.find(l => l.date === today);
  const aiPlan = data?.aiPlan;
  const hasWeight = Boolean(todayLog?.weight);

  useEffect(() => {
    if (todayLog?.weight) setWeight(String(todayLog.weight));
  }, [todayLog?.weight]);

  useEffect(() => {
    if (!uid || todayLog?.weight) return;
    getDailyLog(uid, today).then(log => {
      if (log?.weight) setWeight(String(log.weight));
    });
  }, [today, todayLog?.weight, uid]);

  const saveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) {
      setStatus('error');
      setErrorMsg('体重を入力してください');
      return;
    }

    setStatus('loading');
    try {
      const payload = {
        date: today,
        weight: parseFloat(weight),
      };

      if (uid) {
        await saveDailyLog(uid, today, payload);
      }

      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, gas: gasEndpoint }),
      });

      setStatus('success');
      setEditing(false);
      setTimeout(() => {
        setStatus('idle');
        onSubmit();
      }, 900);
    } catch {
      setStatus('error');
      setErrorMsg('送信に失敗しました。もう一度お試しください。');
    }
  };

  return (
    <div className="px-4 pb-4 fade-in">
      <div className="pt-10 pb-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-blue-400">MORNING SYNC</p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">今日の計画</h1>
            <p className="mt-0.5 text-xs text-slate-500">{today}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1e2d40] bg-[#111827] px-3 py-2 text-[11px] font-bold text-slate-300 active:scale-95"
          >
            <RefreshCw size={12} />
            同期
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-blue-500/25 bg-[#111827] p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <StatusPill ok={Boolean(sync?.hasMorningReport)} label={sync?.hasMorningReport ? '朝報告 反映済み' : '朝報告 待ち'} />
          <StatusPill ok={Boolean(sync?.aiPlanReady)} label={sync?.aiPlanReady ? '今日のAI計画あり' : '今日のAI計画待ち'} />
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          朝食後にGemini Sparkへ、昨日の歩数・睡眠時間・今朝の筋肉痛・今日の予定・朝食を報告すると、
          Geminiがスプレッドシートへ反映し、この画面に今日の計画として表示されます。
        </p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <InfoRow
          label="昨日の歩数"
          value={sync?.yesterdaySteps ? `${sync.yesterdaySteps.toLocaleString()} 歩` : ''}
          icon={<Footprints size={12} className="text-teal-400" />}
        />
        <InfoRow
          label="睡眠"
          value={sync?.sleep ?? ''}
          icon={<Sparkles size={12} className="text-indigo-400" />}
        />
        <InfoRow
          label="筋肉痛"
          value={sync?.doms ?? ''}
          icon={<Dumbbell size={12} className="text-red-400" />}
        />
        <InfoRow
          label="朝食"
          value={sync?.breakfast ?? ''}
          icon={<Utensils size={12} className="text-amber-400" />}
        />
      </div>

      <div className="mb-3 rounded-2xl border border-[#1e2d40] bg-[#111827] p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">今日の予定</p>
            <p className={`mt-1 text-sm font-semibold ${sync?.todayPlan ? 'text-slate-100' : 'text-slate-600'}`}>
              {sync?.todayPlan || '未反映'}
            </p>
          </div>
          {sync?.aiPlanDate && (
            <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-300">
              計画日 {sync.aiPlanDate}
            </span>
          )}
        </div>
        {aiPlan ? (
          <div className="mt-3 rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={13} className="text-yellow-300" />
              <span className="text-xs font-black text-yellow-200">Gemini Spark 今日の計画</span>
            </div>
            <p className="text-xs leading-relaxed text-yellow-50/80 whitespace-pre-line">
              {aiPlan.rawText}
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
            Geminiの朝計画がまだ読み込まれていません。
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[#1e2d40] bg-[#111827] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-blue-400" />
            <div>
              <p className="text-xs font-bold text-slate-200">体重記録</p>
              <p className="text-[10px] text-slate-500">アプリから書くのは体重のみ。歩数・K列はGemini管轄です。</p>
            </div>
          </div>
          {hasWeight && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-full border border-[#1e2d40] px-3 py-1.5 text-[11px] font-bold text-slate-400"
            >
              <Pencil size={11} />
              編集
            </button>
          )}
        </div>

        {hasWeight && !editing ? (
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white">{todayLog?.weight}</span>
            <span className="text-xl text-slate-400">kg</span>
          </div>
        ) : (
          <form onSubmit={saveWeight} className="space-y-3">
            <div className="flex items-baseline gap-2 rounded-xl border border-blue-500/35 bg-[#0f1a2b] px-3 py-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weight}
                onChange={e => {
                  setWeight(e.target.value);
                  if (status !== 'idle') setStatus('idle');
                }}
                placeholder="90.0"
                className="min-w-0 flex-1 bg-transparent text-4xl font-black text-white outline-none placeholder-slate-700"
              />
              <span className="text-lg text-slate-400">kg</span>
            </div>
            {status === 'error' && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{errorMsg}</p>
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                <p className="text-xs text-emerald-400">保存しました</p>
              </div>
            )}
            <button
              type="submit"
              disabled={status === 'loading' || status === 'success'}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #2563eb, #0f766e)' }}
            >
              {status === 'loading'
                ? <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <><Send size={16} /> 体重を保存</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
