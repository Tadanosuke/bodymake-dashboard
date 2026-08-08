"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Send, Footprints } from "lucide-react";
import WorkoutLogger from "./WorkoutLogger";
import { saveWorkoutHistory, formatWorkoutForSheet, type ExerciseSession } from "@/lib/exercises";

interface Props {
  onSubmit: () => void;
}

export default function QuickInput({ onSubmit }: Props) {
  const [weight,    setWeight]    = useState('');
  const [steps,     setSteps]     = useState('');
  const [exercises, setExercises] = useState<ExerciseSession[]>([]);
  const [status,    setStatus]    = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg,  setErrorMsg]  = useState('');

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) { setStatus('error'); setErrorMsg('体重を入力してください'); return; }

    setStatus('loading');
    try {
      const workoutStr = formatWorkoutForSheet(exercises);
      const res = await fetch('/api/log', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:    today,
          weight:  parseFloat(weight),
          steps:   steps ? parseInt(steps) : undefined,
          workout: workoutStr || undefined,
        }),
      });
      if (!res.ok) throw new Error('送信失敗');

      // Save workout history for "Last Record" feature
      saveWorkoutHistory(exercises, today);

      setStatus('success');
      setTimeout(() => {
        setWeight(''); setSteps(''); setExercises([]); setStatus('idle');
        onSubmit();
      }, 1500);
    } catch {
      setStatus('error');
      setErrorMsg('送信に失敗しました。もう一度お試しください。');
    }
  };

  return (
    <div className="px-4 pb-4 fade-in">
      {/* Header */}
      <div className="pt-12 pb-5">
        <p className="text-[11px] text-blue-400 font-semibold tracking-widest uppercase mb-1">QUICK LOG</p>
        <h1 className="text-2xl font-bold text-white">今日の記録</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Weight — prominent */}
        <div className="bg-[#111827] border-2 border-blue-500/40 rounded-2xl p-4">
          <label className="text-xs text-blue-400 font-semibold uppercase tracking-wide">体重 *</label>
          <div className="flex items-baseline gap-2 mt-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={e => { setWeight(e.target.value); if (status !== 'idle') setStatus('idle'); }}
              placeholder="90.0"
              className="flex-1 bg-transparent text-4xl font-black text-white placeholder-slate-700 outline-none"
            />
            <span className="text-lg text-slate-400">kg</span>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-3.5 flex items-center gap-3">
          <Footprints size={18} className="text-teal-400 shrink-0" />
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">歩数（任意）</label>
            <div className="flex items-baseline gap-1 mt-0.5">
              <input
                type="number"
                inputMode="numeric"
                value={steps}
                onChange={e => setSteps(e.target.value)}
                placeholder="8000"
                className="flex-1 bg-transparent text-xl font-bold text-slate-100 placeholder-slate-700 outline-none"
              />
              <span className="text-xs text-slate-500">歩</span>
            </div>
          </div>
        </div>

        {/* Workout logger */}
        <WorkoutLogger exercises={exercises} onChange={setExercises} />

        {/* PFC note */}
        <div className="flex items-start gap-2 bg-[#0f1a2b] border border-[#1e2d40] rounded-xl px-3.5 py-3">
          <span className="text-[10px] text-slate-500 leading-relaxed">
            💬 PFC・カロリーはGemini Sparkが食事写真から自動解析してスプレッドシートに記録します。ここでの入力は不要です。
          </span>
        </div>

        {/* Status */}
        {status === 'error' && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{errorMsg}</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">記録を保存しました！ダッシュボードへ戻ります...</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          {status === 'loading' ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send size={16} />
              記録を保存する
            </>
          )}
        </button>
      </form>
    </div>
  );
}
