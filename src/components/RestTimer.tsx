"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Play, Pause, RotateCcw } from "lucide-react";

interface Props {
  initialSeconds: number;
  onClose: () => void;
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    [0, 0.15, 0.30].forEach(t => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = t === 0.30 ? 1046 : 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
  } catch {}
}

function vibrate(pattern: number[]) {
  try { navigator.vibrate?.(pattern); } catch {}
}

const DURATIONS = [60, 90, 120] as const;
const RADIUS = 52;
const CIRC   = 2 * Math.PI * RADIUS;

export default function RestTimer({ initialSeconds, onClose }: Props) {
  const [total,     setTotal]     = useState(initialSeconds);
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running,   setRunning]   = useState(true);
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    if (!running || done) return;
    const id = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(id);
          setRunning(false);
          setDone(true);
          playBeep();
          vibrate([200, 100, 200, 100, 400]);
          return 0;
        }
        if (r <= 4) vibrate([50]);
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, done]);

  const reset = useCallback((dur: number) => {
    setTotal(dur);
    setRemaining(dur);
    setRunning(true);
    setDone(false);
  }, []);

  const pct        = remaining / total;
  const dashOffset = CIRC * (1 - pct);
  const mins       = Math.floor(remaining / 60);
  const secs       = remaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="bg-[#0d1526] border border-[#1e2d40] rounded-3xl p-6 w-72 flex flex-col items-center gap-5 shadow-2xl">

        {/* Title */}
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-bold text-slate-300">インターバルタイマー</span>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        {/* Circular progress */}
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
            <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#1e2d40" strokeWidth="10" />
            <circle
              cx="70" cy="70" r={RADIUS} fill="none"
              stroke={done ? "#10b981" : remaining <= 10 ? "#ef4444" : "#ef4444"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {done ? (
              <span className="text-2xl font-black text-emerald-400">完了！</span>
            ) : (
              <>
                <span className="text-4xl font-black text-white tabular-nums">
                  {mins > 0 ? `${mins}:${String(secs).padStart(2,'0')}` : secs}
                </span>
                <span className="text-xs text-slate-500">秒</span>
              </>
            )}
          </div>
        </div>

        {/* Duration presets */}
        <div className="flex gap-2">
          {DURATIONS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => reset(d)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                total === d && !done
                  ? 'bg-red-600 text-white border-transparent'
                  : 'border-[#2a3a55] text-slate-400 hover:text-slate-200'
              }`}
            >
              {d}秒
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={() => setRunning(r => !r)}
            disabled={done}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40"
          >
            {running ? <><Pause size={16} /> 一時停止</> : <><Play size={16} /> 再開</>}
          </button>
          <button
            type="button"
            onClick={() => reset(total)}
            className="flex items-center justify-center bg-[#1a2235] border border-[#2a3a55] text-slate-300 p-3 rounded-2xl hover:bg-[#2a3a55] transition-all active:scale-95"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {done && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-2xl active:scale-95 transition-all"
          >
            次のセットへ
          </button>
        )}
      </div>
    </div>
  );
}
