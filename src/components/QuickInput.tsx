"use client";

import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, AlertCircle, Send, Footprints, Moon, Sun, Pencil } from "lucide-react";
import { getDailyLog } from "@/lib/firestore";
import { useCurrentUser } from "./AuthGate";

interface Props {
  onSubmit: () => void;
}

const DOMS_OPTIONS  = ['胸', '背中', '脚', '肩', '腕', '腹筋', 'なし'] as const;
const TOMORROW_TAGS = ['フリー(自宅)', 'アルバイト', '六本木お泊まり', '多忙/OFF'] as const;

function calcSleepHours(bed: string, wake: string): string | null {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 24 * 60;
  return String(Math.round(mins / 6) / 10);
}

function sleepColor(h: string | null) {
  if (!h) return 'text-slate-500';
  const n = parseFloat(h);
  if (n >= 7) return 'text-emerald-400';
  if (n >= 6) return 'text-amber-400';
  return 'text-red-400';
}

export default function QuickInput({ onSubmit }: Props) {
  const currentUser = useCurrentUser();
  const uid = currentUser?.uid ?? '';

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-');

  const [pageState, setPageState] = useState<'loading' | 'view' | 'form'>('loading');

  const [weight,   setWeight]   = useState('');
  const [steps,    setSteps]    = useState('');
  const [status,   setStatus]   = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Sleep
  const [bedtime,  setBedtime]  = useState('');
  const [waketime, setWaketime] = useState('');
  const sleepHours = useMemo(() => calcSleepHours(bedtime, waketime), [bedtime, waketime]);
  const goodMorning = () => {
    const now = new Date();
    setWaketime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
  };

  // DOMS
  const [doms, setDoms] = useState<string[]>([]);
  const toggleDoms = (opt: string) => {
    if (opt === 'なし') { setDoms(d => d.includes('なし') ? [] : ['なし']); return; }
    setDoms(d => {
      const without = d.filter(x => x !== 'なし');
      return without.includes(opt) ? without.filter(x => x !== opt) : [...without, opt];
    });
  };

  const [tomorrowTag, setTomorrowTag] = useState('');

  const [todayLog, setTodayLog] = useState<Awaited<ReturnType<typeof getDailyLog>>>(null);

  // 入力済みの値をフォームへ復元する（体重が無くても部分的な入力は必ず戻す）
  const hydrate = (log: Awaited<ReturnType<typeof getDailyLog>>) => {
    if (!log) return;
    if (log.weight)   setWeight(String(log.weight));
    if (log.steps)    setSteps(String(log.steps));
    if (log.tomorrow) setTomorrowTag(log.tomorrow);
    if (log.doms)     setDoms(log.doms === 'なし' ? ['なし'] : log.doms.split(', '));
    if (log.sleep) {
      const m = log.sleep.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (m) { setBedtime(m[1]); setWaketime(m[2]); }
    }
  };

  useEffect(() => {
    if (!uid) { setPageState('form'); return; }
    let settled = false;
    // Firestore が遅いときは先にフォームを出す。結果が届いたら値を流し込む。
    const timer = setTimeout(() => { if (!settled) setPageState('form'); }, 3000);

    getDailyLog(uid, today)
      .then(log => {
        settled = true;
        clearTimeout(timer);
        setTodayLog(log);
        hydrate(log);
        setPageState(log?.weight ? 'view' : 'form');
      })
      .catch(() => {
        settled = true;
        clearTimeout(timer);
        setPageState('form');
      });

    return () => clearTimeout(timer);
  }, [today, uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) { setStatus('error'); setErrorMsg('体重を入力してください'); return; }
    setStatus('loading');
    try {
      const sleepStr = sleepHours ? `${sleepHours}時間 (${bedtime}-${waketime})` : '';
      const domsStr  = doms.length > 0 ? doms.join(', ') : '';

      await fetch('/api/log', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          date:     today,
          weight:   parseFloat(weight),
          steps:    steps ? parseInt(steps) : undefined,
          sleep:    sleepStr   || undefined,
          doms:     domsStr    || undefined,
          tomorrow: tomorrowTag || undefined,
        }),
      });

      // 保存した内容を即座に画面へ反映（その日のうちは値が残る）
      setTodayLog({
        date:      today,
        weight:    parseFloat(weight),
        steps:     steps ? parseInt(steps) : undefined,
        sleep:     sleepStr  || undefined,
        doms:      domsStr   || undefined,
        tomorrow:  tomorrowTag || undefined,
        updatedAt: new Date().toISOString(),
      });

      setStatus('success');
      setTimeout(() => { setStatus('idle'); setPageState('view'); onSubmit(); }, 1500);
    } catch {
      setStatus('error');
      setErrorMsg('送信に失敗しました。もう一度お試しください。');
    }
  };

  // ─── ローディング ──────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ─── 今日の体重表示モード ──────────────────────────────────────────────────
  if (pageState === 'view' && todayLog?.weight) {
    return (
      <div className="px-4 pb-4 fade-in">
        <div className="pt-10 pb-4">
          <p className="text-[11px] text-blue-400 font-semibold tracking-widest uppercase mb-0.5">TODAY</p>
          <h1 className="text-2xl font-bold text-white">今日の記録</h1>
          <p className="text-xs text-slate-500 mt-0.5">{today}</p>
        </div>

        <div className="bg-[#111827] border-2 border-emerald-500/30 rounded-2xl p-5 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span className="text-xs text-emerald-400 font-semibold">記録済み</span>
            </div>
            <button
              type="button"
              onClick={() => setPageState('form')}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-blue-400 border border-[#1e2d40] hover:border-blue-500/50 px-3 py-1.5 rounded-full transition-all"
            >
              <Pencil size={10} />編集
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white">{todayLog.weight}</span>
            <span className="text-xl text-slate-400">kg</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {todayLog.steps != null && todayLog.steps > 0 && (
              <span className="text-[11px] bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2.5 py-1 rounded-full">
                {todayLog.steps.toLocaleString()} 歩
              </span>
            )}
            {todayLog.sleep && (
              <span className="text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                {todayLog.sleep}
              </span>
            )}
            {todayLog.doms && todayLog.doms !== 'なし' && (
              <span className="text-[11px] bg-red-500/10 text-red-300 border border-red-500/20 px-2.5 py-1 rounded-full">
                筋肉痛: {todayLog.doms}
              </span>
            )}
            {todayLog.tomorrow && (
              <span className="text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-full">
                明日: {todayLog.tomorrow}
              </span>
            )}
          </div>
        </div>

        <p className="text-[10px] text-slate-600 text-center mb-3">
          体重は1日1回計測。修正する場合は「編集」から。
        </p>
      </div>
    );
  }

  // ─── 入力フォーム ──────────────────────────────────────────────────────────
  return (
    <div className="px-4 pb-4 fade-in">
      <div className="pt-10 pb-4">
        <p className="text-[11px] text-blue-400 font-semibold tracking-widest uppercase mb-0.5">
          {pageState === 'form' && todayLog?.weight ? 'EDIT' : 'QUICK LOG'}
        </p>
        <h1 className="text-2xl font-bold text-white">
          {todayLog?.weight ? '記録を編集' : '今日の記録'}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">{today}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* 体重 */}
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

        {/* 睡眠 */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-slate-200">睡眠</span>
              {sleepHours && (
                <span className={`text-sm font-black ${sleepColor(sleepHours)}`}>{sleepHours}時間</span>
              )}
            </div>
            <button type="button" onClick={goodMorning}
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 text-amber-300 text-[11px] font-semibold active:scale-95 transition-all">
              <Sun size={11} />おはよう（今）
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">就寝</p>
              <input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)}
                className="w-full bg-[#0f1a2b] border border-[#1e2d40] rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">起床</p>
              <input type="time" value={waketime} onChange={e => setWaketime(e.target.value)}
                className="w-full bg-[#0f1a2b] border border-[#1e2d40] rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                style={{ colorScheme: 'dark' }} />
            </div>
          </div>
        </div>

        {/* DOMS */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
            <span className="text-base">🔥</span>本日の筋肉痛 (DOMS)
          </p>
          <div className="flex flex-wrap gap-2">
            {DOMS_OPTIONS.map(opt => {
              const active = doms.includes(opt);
              return (
                <button key={opt} type="button" onClick={() => toggleDoms(opt)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                    active
                      ? opt === 'なし'
                        ? 'bg-slate-600 text-white border-transparent'
                        : 'bg-red-500/30 text-red-200 border-red-500/50'
                      : 'bg-[#0f1a2b] text-slate-400 border-[#2a3a55] hover:text-slate-200'
                  }`}>{opt}</button>
              );
            })}
          </div>
        </div>

        {/* 明日の予定 */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
            <span className="text-base">📅</span>明日の予定
          </p>
          <div className="flex flex-wrap gap-2">
            {TOMORROW_TAGS.map(tag => (
              <button key={tag} type="button" onClick={() => setTomorrowTag(tomorrowTag === tag ? '' : tag)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                  tomorrowTag === tag
                    ? 'bg-blue-600 text-white border-transparent'
                    : 'bg-[#0f1a2b] text-slate-400 border-[#2a3a55] hover:text-slate-200'
                }`}>{tag}</button>
            ))}
          </div>
        </div>

        {/* 歩数 */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-3.5 flex items-center gap-3">
          <Footprints size={18} className="text-teal-400 shrink-0" />
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">歩数（任意）</label>
            <div className="flex items-baseline gap-1 mt-0.5">
              <input type="number" inputMode="numeric" value={steps} onChange={e => setSteps(e.target.value)}
                placeholder="8000"
                className="flex-1 bg-transparent text-xl font-bold text-slate-100 placeholder-slate-700 outline-none" />
              <span className="text-xs text-slate-500">歩</span>
            </div>
          </div>
        </div>

        {/* ステータス */}
        {status === 'error' && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{errorMsg}</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">保存しました！</p>
          </div>
        )}

        {/* 送信ボタン */}
        <button type="submit" disabled={status === 'loading' || status === 'success'}
          className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          {status === 'loading'
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><Send size={16} /> {todayLog?.weight ? '更新する' : '記録を保存する'}</>}
        </button>
      </form>
    </div>
  );
}
