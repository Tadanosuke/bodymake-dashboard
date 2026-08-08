"use client";

import dynamic from "next/dynamic";
import { TrendingDown, Calendar, Zap, Activity, Flame } from "lucide-react";
import MilestoneCards from "./MilestoneCards";
import NutritionMeters from "./NutritionMeters";
import type { DashboardData } from "@/lib/types";

const WeightChart = dynamic(() => import("./WeightChart"), { ssr: false });

interface Props {
  data: DashboardData;
}

function StatBadge({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-3 bg-[#111827] border border-[#1e2d40] flex flex-col gap-0.5`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

function calcDaysAhead(data: DashboardData): number {
  const startMs = new Date(data.startDate).getTime();
  const finalMs = new Date(data.finalTargetDate).getTime();
  const nowMs   = Date.now();
  const totalDays   = (finalMs - startMs) / 86400000;
  const daysPassed  = (nowMs  - startMs) / 86400000;
  if (totalDays <= 0 || daysPassed < 0) return 0;
  const expectedWeight = data.startWeight - (daysPassed / totalDays) * (data.startWeight - data.finalTarget);
  const dailyRate = (data.startWeight - data.finalTarget) / totalDays;
  return Math.round((expectedWeight - data.currentWeight) / dailyRate);
}

export default function Dashboard({ data }: Props) {
  const lost = data.startWeight - data.currentWeight;
  const remaining = data.currentWeight - data.finalTarget;
  const progressPct = Math.round((lost / (data.startWeight - data.finalTarget)) * 100);
  const daysAhead = calcDaysAhead(data);

  const last7Logs = data.logs.slice(-7);
  const weeklyCals = last7Logs.reduce((sum, l) => sum + (l.calories || 0), 0);
  const weeklyTarget = data.today.calories.target * 7;
  const weeklyBalance = weeklyCals - weeklyTarget;

  return (
    <div className="px-4 pb-4 space-y-4 fade-in">
      {/* Header */}
      <div
        className="pt-12 pb-5 px-1"
        style={{
          background: "linear-gradient(180deg, #0d1b35 0%, #0a0f1e 100%)",
        }}
      >
        <p className="text-[11px] text-blue-400 font-semibold tracking-widest uppercase mb-1">
          15kg減量 ボディメイクプロジェクト
        </p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-5xl font-black text-white tracking-tight">
              {data.currentWeight}
              <span className="text-xl font-medium text-slate-400 ml-1">kg</span>
            </p>
            <div className="flex items-center gap-2 mt-1">
              <TrendingDown size={13} className="text-emerald-400" />
              <span className="text-sm text-emerald-400 font-semibold">-{lost.toFixed(1)} kg</span>
              <span className="text-xs text-slate-500">開始時から</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">最終目標</p>
            <p className="text-2xl font-bold text-purple-400">{data.finalTarget} kg</p>
            <p className="text-xs text-slate-500">あと {remaining.toFixed(1)} kg</p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>スタート {data.startWeight}kg</span>
            <span className="text-blue-400 font-semibold">{progressPct}% 達成</span>
            <span>目標 {data.finalTarget}kg</span>
          </div>
          <div className="h-2.5 bg-[#1e2d40] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-500"
              style={{ width: `${progressPct}%`, transition: "width 1s ease-out" }}
            />
          </div>
        </div>

        {/* Days-ahead badge */}
        {daysAhead !== 0 && (
          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            daysAhead > 0
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
          }`}>
            {daysAhead > 0 ? `⚡ 計画より ${daysAhead}日 前倒し` : `⚠ 計画より ${Math.abs(daysAhead)}日 遅れ`}
          </div>
        )}
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatBadge
          label="Phase目標"
          value={`${data.phaseTarget} kg`}
          sub={`あと ${(data.currentWeight - data.phaseTarget).toFixed(1)} kg`}
          color="text-amber-400"
        />
        <StatBadge
          label="残り日数(Phase)"
          value={`${data.daysToPhaseTarget} 日`}
          sub={`週 -${data.weeklyLossRate} kg ペース`}
          color="text-blue-400"
        />
        <StatBadge
          label="最終目標まで"
          value={`${data.daysToFinalTarget} 日`}
          sub="2027年1月末"
          color="text-purple-400"
        />
        <StatBadge
          label="週間減少率"
          value={`-${data.weeklyLossRate} kg`}
          sub="目標 -0.5～0.7 kg"
          color="text-emerald-400"
        />
      </div>

      {/* Weight chart */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-200">体重推移＆予測</h2>
          </div>
          <div className="flex gap-2 text-[9px]">
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-4 border-t border-amber-400 border-dashed" />
              Phase目標
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-4 border-t border-emerald-400 border-dashed" />
              最終目標
            </span>
          </div>
        </div>
        <WeightChart
          data={data.weightHistory}
          phaseTarget={data.phaseTarget}
          finalTarget={data.finalTarget}
        />
      </div>

      {/* Milestones */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={15} className="text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-200">マイルストーン</h2>
        </div>
        <MilestoneCards milestones={data.milestones} currentWeight={data.currentWeight} />
      </div>

      {/* Nutrition & Steps */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={15} className="text-orange-400" />
          <h2 className="text-sm font-semibold text-slate-200">本日の栄養＆歩数</h2>
        </div>
        <NutritionMeters today={data.today} />
      </div>

      {/* Weekly calorie balance */}
      {last7Logs.length > 0 && (
        <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame size={15} className="text-orange-400" />
              <h2 className="text-sm font-semibold text-slate-200">週間カロリー収支</h2>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              weeklyBalance < 0
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-red-500/15 text-red-400'
            }`}>
              {weeklyBalance < 0 ? `${weeklyBalance.toLocaleString()} kcal` : `+${weeklyBalance.toLocaleString()} kcal`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#0f1a2b] rounded-xl p-2">
              <p className="text-[10px] text-slate-500 mb-0.5">直近{last7Logs.length}日</p>
              <p className="text-base font-black text-white">{weeklyCals.toLocaleString()}</p>
              <p className="text-[9px] text-slate-500">kcal 摂取</p>
            </div>
            <div className="bg-[#0f1a2b] rounded-xl p-2">
              <p className="text-[10px] text-slate-500 mb-0.5">目標</p>
              <p className="text-base font-black text-slate-300">{weeklyTarget.toLocaleString()}</p>
              <p className="text-[9px] text-slate-500">kcal 想定</p>
            </div>
            <div className={`rounded-xl p-2 ${weeklyBalance < 0 ? 'bg-emerald-900/20' : 'bg-red-900/20'}`}>
              <p className="text-[10px] text-slate-500 mb-0.5">収支</p>
              <p className={`text-base font-black ${weeklyBalance < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {weeklyBalance < 0 ? weeklyBalance.toLocaleString() : `+${weeklyBalance.toLocaleString()}`}
              </p>
              <p className="text-[9px] text-slate-500">kcal</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Plan card */}
      {data.aiPlan && (
        <div className="bg-[#111827] border border-yellow-600/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={15} className="text-yellow-400" />
            <h2 className="text-sm font-semibold text-yellow-300">Gemini AI 次回計画</h2>
            <span className="text-[10px] text-slate-500 ml-auto">{data.aiPlan.date}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
            {data.aiPlan.rawText}
          </p>
        </div>
      )}
    </div>
  );
}
