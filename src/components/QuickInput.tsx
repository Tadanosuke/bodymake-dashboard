"use client";

import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, AlertCircle, Send, Footprints, Moon, Sun, MapPin } from "lucide-react";
import WorkoutLogger from "./WorkoutLogger";
import {
  saveWorkoutHistory, saveWorkoutSession, formatWorkoutForSheet,
  type ExerciseSession, type Store, STORE_KEY,
} from "@/lib/exercises";

interface Props {
  onSubmit: () => void;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────
const DOMS_OPTIONS  = ['胸', '背中', '脚', '肩', '腕', '腹筋', 'なし'] as const;
const TOMORROW_TAGS = ['フリー(自宅)', 'アルバイト', '六本木お泊まり', '多忙/OFF'] as const;

function calcSleepHours(bed: string, wake: string): string | null {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 24 * 60;
  const hours = Math.round(mins / 6) / 10; // 0.1h刻み
  return `${hours}`;
}

function sleepColor(h: string | null) {
  if (!h) return 'text-slate-500';
  const n = parseFloat(h);
  if (n >= 7)  return 'text-emerald-400';
  if (n >= 6)  return 'text-amber-400';
  return 'text-red-400';
}

// ─── QuickInput ───────────────────────────────────────────────────────────────
export default function QuickInput({ onSubmit }: Props) {
  // 基本
  const [weight,    setWeight]    = useState('');
  const [steps,     setSteps]     = useState('');
  const [exercises, setExercises] = useState<ExerciseSession[]>([]);
  const [status,    setStatus]    = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg,  setErrorMsg]  = useState('');

  // 店舗（localStorageで永続化）
  const [store, setStore] = useState<Store>('自宅・牛久店');
  useEffect(() => {
    const saved = localStorage.getItem(STORE_KEY) as Store | null;
    if (saved) setStore(saved);
  }, []);
  const changeStore = (s: Store) => { setStore(s); localStorage.setItem(STORE_KEY, s); };

  // 睡眠
  const [bedtime,  setBedtime]  = useState('');
  const [waketime, setWaketime] = useState('');
  const sleepHours = useMemo(() => calcSleepHours(bedtime, waketime), [bedtime, waketime]);
  const goodMorning = () => {
    const now = new Date();
    setWaketime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
  };

  // 筋肉痛DOMS
  const [doms, setDoms] = useState<string[]>([]);
  const toggleDoms = (opt: string) => {
    if (opt === 'なし') { setDoms(d => d.includes('なし') ? [] : ['なし']); return; }
    setDoms(d => {
      const without = d.filter(x => x !== 'なし');
      return without.includes(opt) ? without.filter(x => x !== opt) : [...without, opt];
    });
  };

  // 明日の予定
  const [tomorrowTag, setTomorrowTag] = useState('');

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) { setStatus('error'); setErrorMsg('体重を入力してください'); return; }

    setStatus('loading');
    try {
      const workoutStr  = formatWorkoutForSheet(exercises);
      const sleepStr    = sleepHours ? `${sleepHours}時間 (${bedtime}-${waketime})` : '';
      const domsStr     = doms.length > 0 ? doms.join(', ') : '';

      const res = await fetch('/api/log', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:        today,
          weight:      parseFloat(weight),
          steps:       steps ? parseInt(steps) : undefined,
          workout:     workoutStr || undefined,
          sleep:       sleepStr   || undefined,
          doms:        domsStr    || undefined,
          tomorrow:    tomorrowTag || undefined,
        }),
      });
      if (!res.ok) throw new Error('送信失敗');

      saveWorkoutHistory(exercises, today);
      saveWorkoutSession(exercises, today);
      setStatus('success');
      setTimeout(() => {
        setWeight(''); setSteps(''); setExercises([]);
        setBedtime(''); setWaketime(''); setDoms([]); setTomorrowTag('');
        setStatus('idle');
        onSubmit();
      }, 1500);
    } catch {
      setStatus('error');
      setErrorMsg('送信に失敗しました。もう一度お試しください。');
    }
  };

  return (
    <div className="px-4 pb-4 fade-in">
      {/* Header + 店舗切替 */}
      <div className="pt-10 pb-4 flex items-start justify-between">
        <div>
          <p className="text-[11px] text-blue-400 font-semibold tracking-widest uppercase mb-0.5">QUICK LOG</p>
          <h1 className="text-2xl font-bold text-white">今日の記録</h1>
          <p className="text-xs text-slate-500 mt-0.5">{today}</p>
        </div>

        {/* 店舗切替トグル */}
        <div className="flex items-center bg-[#111827] border border-[#1e2d40] rounded-full p-0.5 mt-1">
          {(['自宅・牛久店', '赤坂店'] as Store[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => changeStore(s)}
              className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all ${
                store === s
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <MapPin size={9} />
              {s === '赤坂店' ? '赤坂' : '牛久'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* ── 体重 ── */}
        <div className="bg-[#111827] border-2 border-blue-500/40 rounded-2xl p-4">
          <label className="text-xs text-blue-400 font-semibold uppercase tracking-wide">体重 *</label>
          <div className="flex items-baseline gap-2 mt-1">
            <input
              type="number" inputMode="decimal" step="0.1"
              value={weight}
              onChange={e => { setWeight(e.target.value); if (status !== 'idle') setStatus('idle'); }}
              placeholder="90.0"
              className="flex-1 bg-transparent text-4xl font-black text-white placeholder-slate-700 outline-none"
            />
            <span className="text-lg text-slate-400">kg</span>
          </div>
        </div>

        {/* ── 睡眠トラッカー ── */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-slate-200">睡眠</span>
              {sleepHours && (
                <span className={`text-sm font-black ${sleepColor(sleepHours)}`}>
                  {sleepHours}時間
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={goodMorning}
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 text-amber-300 text-[11px] font-semibold active:scale-95 transition-all"
            >
              <Sun size={11} />
              おはよう（今）
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">就寝</p>
              <input
                type="time"
                value={bedtime}
                onChange={e => setBedtime(e.target.value)}
                className="w-full bg-[#0f1a2b] border border-[#1e2d40] rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">起床</p>
              <input
                type="time"
                value={waketime}
                onChange={e => setWaketime(e.target.value)}
                className="w-full bg-[#0f1a2b] border border-[#1e2d40] rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
        </div>

        {/* ── 筋肉痛チェック ── */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
            <span className="text-base">🔥</span>
            本日の筋肉痛 (DOMS)
          </p>
          <div className="flex flex-wrap gap-2">
            {DOMS_OPTIONS.map(opt => {
              const active = doms.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleDoms(opt)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                    active
                      ? opt === 'なし'
                        ? 'bg-slate-600 text-white border-transparent'
                        : 'bg-red-500/30 text-red-200 border-red-500/50'
                      : 'bg-[#0f1a2b] text-slate-400 border-[#2a3a55] hover:text-slate-200'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 明日の予定タグ ── */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
            <span className="text-base">📅</span>
            明日の予定
          </p>
          <div className="flex flex-wrap gap-2">
            {TOMORROW_TAGS.map(tag => {
              const active = tomorrowTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTomorrowTag(active ? '' : tag)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                    active
                      ? 'bg-blue-600 text-white border-transparent'
                      : 'bg-[#0f1a2b] text-slate-400 border-[#2a3a55] hover:text-slate-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 歩数 ── */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-3.5 flex items-center gap-3">
          <Footprints size={18} className="text-teal-400 shrink-0" />
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">歩数（任意）</label>
            <div className="flex items-baseline gap-1 mt-0.5">
              <input
                type="number" inputMode="numeric"
                value={steps}
                onChange={e => setSteps(e.target.value)}
                placeholder="8000"
                className="flex-1 bg-transparent text-xl font-bold text-slate-100 placeholder-slate-700 outline-none"
              />
              <span className="text-xs text-slate-500">歩</span>
            </div>
          </div>
        </div>

        {/* ── 筋トレログ ── */}
        <WorkoutLogger store={store} exercises={exercises} onChange={setExercises} />

        {/* PFC note */}
        <div className="bg-[#0f1a2b] border border-[#1e2d40] rounded-xl px-3.5 py-3">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            💬 PFC・カロリーはGemini Sparkが食事写真から自動解析しスプレッドシートへ記録します。こちらでの入力は不要です。
          </p>
        </div>

        {/* ── ステータス ── */}
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

        {/* ── 送信ボタン ── */}
        <button
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          {status === 'loading' ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Send size={16} /> 記録を保存する</>
          )}
        </button>
      </form>
    </div>
  );
}
