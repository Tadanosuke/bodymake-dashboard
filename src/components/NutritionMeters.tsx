"use client";

import type { TodayMetrics } from "@/lib/types";

interface Props {
  today: TodayMetrics;
}

interface MeterProps {
  label: string;
  unit: string;
  actual: number;
  target: number;
  color: string;
  bgColor: string;
}

function Meter({ label, unit, actual, target, color, bgColor }: MeterProps) {
  const pct = Math.min((actual / target) * 100, 100);
  const over = actual > target;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-slate-200">
          <span className={over ? "text-amber-400" : ""}>{actual}</span>
          <span className="text-slate-500">/{target}{unit}</span>
        </span>
      </div>
      <div className={`h-2 rounded-full ${bgColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepsMeter({ actual, target }: { actual: number; target: number }) {
  const pct = Math.min((actual / target) * 100, 100);
  return (
    <div className="mt-2">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-400">歩数</span>
        <span className="text-xs font-semibold">
          <span className="text-teal-300">{actual.toLocaleString()}</span>
          <span className="text-slate-500">/{target.toLocaleString()} 歩</span>
        </span>
      </div>
      <div className="h-3 bg-[#1a2235] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all duration-700 relative"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/30 rounded-full" />
        </div>
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-slate-600">0</span>
        <span className="text-[10px] text-slate-600">{Math.round(pct)}%</span>
        <span className="text-[10px] text-slate-600">{target.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function NutritionMeters({ today }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Calorie big display */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs text-slate-400">本日のカロリー</p>
          <p className="text-3xl font-bold text-slate-100">
            {today.calories.actual.toLocaleString()}
            <span className="text-sm text-slate-500 font-normal ml-1">kcal</span>
          </p>
          <p className="text-xs text-slate-500">目標: {today.calories.target.toLocaleString()} kcal</p>
        </div>
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#1e2d40" strokeWidth="7" />
            <circle
              cx="32" cy="32" r="26" fill="none"
              stroke="url(#calGrad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 26}`}
              strokeDashoffset={`${2 * Math.PI * 26 * (1 - Math.min(today.calories.actual / today.calories.target, 1))}`}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-amber-400">
            {Math.round((today.calories.actual / today.calories.target) * 100)}%
          </span>
        </div>
      </div>

      {/* PFC bars */}
      <Meter label="タンパク質" unit="g" actual={today.protein.actual} target={today.protein.target} color="bg-blue-500" bgColor="bg-[#1a2235]" />
      <Meter label="脂質" unit="g" actual={today.fat.actual} target={today.fat.target} color="bg-purple-500" bgColor="bg-[#1a2235]" />
      <Meter label="炭水化物" unit="g" actual={today.carbs.actual} target={today.carbs.target} color="bg-orange-500" bgColor="bg-[#1a2235]" />

      {/* Steps */}
      <StepsMeter actual={today.steps.actual} target={today.steps.target} />
    </div>
  );
}
