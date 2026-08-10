"use client";

import dynamic from "next/dynamic";
import { TrendingDown, Zap, Activity, Flame, Sparkles, Dumbbell, Gauge, ShieldCheck, Scale, Route, Moon, RotateCcw, Timer, Beef } from "lucide-react";
import NutritionMeters from "./NutritionMeters";
import type { DashboardData, RoadmapPhase } from "@/lib/types";

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

function ScienceCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-[#1e2d40] bg-[#0f1a2b] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={color}>{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">{sub}</p>
    </div>
  );
}

function PhaseRoadmap({ phases }: { phases: RoadmapPhase[] }) {
  return (
    <div className="space-y-2.5">
      {phases.map((phase) => (
        <div
          key={phase.id}
          className={`rounded-lg border p-3 ${
            phase.active
              ? "border-blue-500/40 bg-blue-500/10"
              : phase.completed
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-[#1e2d40] bg-[#0f1a2b]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  Phase {phase.id}
                </span>
                <p className="text-sm font-bold text-slate-100">{phase.name}</p>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{phase.rangeLabel}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              phase.active
                ? "bg-blue-500/20 text-blue-300"
                : phase.completed
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-700/50 text-slate-400"
            }`}>
              {phase.completed ? "完了" : phase.active ? "現在地" : "次"}
            </span>
          </div>

          <div className="mt-3 h-2 rounded-full bg-[#1e2d40]">
            <div
              className={`h-full rounded-full ${phase.completed ? "bg-emerald-400" : "bg-blue-400"}`}
              style={{ width: `${phase.progressPct}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
            <p>週 {phase.targetWeeklyLossPct}%BW / 約-{phase.approxWeeklyLossKg}kg</p>
            <p className="text-right">{phase.calories.toLocaleString()} kcal</p>
            <p>P {phase.protein}g / F {phase.fat}g / C {phase.carbs}g</p>
            <p className="text-right text-amber-300">{phase.note ?? "標準運用"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniMeter({ value, limit, color }: { value: number; limit: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / limit) * 100)));
  return (
    <div className="mt-2 h-2 rounded-full bg-[#1e2d40]">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function RecoveryCard({
  icon,
  title,
  value,
  sub,
  tone,
  meter,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub: string;
  tone: 'emerald' | 'amber' | 'red' | 'blue';
  meter?: { value: number; limit: number };
}) {
  const toneClass = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    red: 'border-red-500/30 bg-red-500/10 text-red-300',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  }[tone];
  const meterColor = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    blue: 'bg-blue-400',
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-wide">{title}</p>
      </div>
      <p className="text-sm font-black leading-snug text-slate-100">{value}</p>
      <p className="mt-1 text-[10px] leading-snug text-slate-400">{sub}</p>
      {meter && <MiniMeter value={meter.value} limit={meter.limit} color={meterColor} />}
    </div>
  );
}

export default function Dashboard({ data }: Props) {
  // Empty state for new users
  if (data.isEmpty || data.currentWeight === 0) {
    return (
      <div className="px-4 pb-4 fade-in">
        <div className="pt-12 pb-5 px-1" style={{ background: "linear-gradient(180deg, #0d1b35 0%, #0a0f1e 100%)" }}>
          <p className="text-[11px] text-blue-400 font-semibold tracking-widest uppercase mb-1">15kg減量 ボディメイクプロジェクト</p>
          <p className="text-3xl font-black text-white">-- <span className="text-xl font-medium text-slate-400">kg</span></p>
          <p className="text-sm text-slate-500 mt-1">「今日」タブから体重を記録してスタート！</p>
        </div>
        <div className="bg-[#111827] border border-blue-500/20 rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">💪</p>
          <p className="text-base font-bold text-white mb-1">まだデータがありません</p>
          <p className="text-xs text-slate-400">「今日」タブから体重を記録し、朝食後にGeminiへ報告すると<br />ここにグラフと計画が表示されます</p>
        </div>
      </div>
    );
  }

  const lost = data.startWeight - data.currentWeight;
  const remaining = data.currentWeight - data.finalTarget;
  const progressPct = Math.max(0, Math.min(100, Math.round((lost / (data.startWeight - data.finalTarget)) * 100)));
  const trendWeight = data.scienceMetrics.trendWeight;
  const weeklyPct = data.scienceMetrics.weeklyBodyWeightChangePct;
  const weeklyPctAbs = weeklyPct == null ? null : Math.abs(weeklyPct);
  const inSafeZone = weeklyPct != null && weeklyPctAbs != null && weeklyPctAbs >= 0.5 && weeklyPctAbs <= 1.0 && weeklyPct < 0;

  const last7Logs = data.logs.slice(0, 7);
  const weeklyCals = last7Logs.reduce((sum, l) => sum + (l.calories || 0), 0);
  const weeklyTarget = data.today.calories.target * 7;
  const weeklyBalance = weeklyCals - weeklyTarget;
  const recovery = data.recoveryMetrics;
  const sleepTone = recovery.sleepLevel === 'good' ? 'emerald' : recovery.sleepLevel === 'risk' ? 'red' : recovery.sleepLevel === 'caution' ? 'amber' : 'blue';
  const cardioTone = recovery.cardioOverLimit ? 'red' : recovery.weeklyCardioMinutes >= 135 ? 'amber' : 'emerald';
  const proteinTone = data.today.protein.actual >= recovery.proteinTargetMin ? 'emerald' : data.today.protein.actual >= recovery.proteinTargetMin * 0.8 ? 'amber' : 'red';

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

      </div>

      {/* Science KPI grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <ScienceCard
          icon={<Scale size={15} />}
          label="ノイズ除去した実質体重"
          value={trendWeight == null ? "-- kg" : `${trendWeight.toFixed(1)} kg`}
          sub="水分ブレを除いた体重"
          color="text-blue-400"
        />
        <ScienceCard
          icon={<ShieldCheck size={15} />}
          label="今週の減量スピード"
          value={weeklyPct == null ? "-- %" : `${weeklyPct.toFixed(2)}%`}
          sub={inSafeZone ? "安全圏 0.5〜1.0%/週" : "安全圏は0.5〜1.0%/週"}
          color={inSafeZone ? "text-emerald-400" : "text-amber-400"}
        />
        <ScienceCard
          icon={<Gauge size={15} />}
          label="実測消費代謝量 (TDEE)"
          value={data.scienceMetrics.dynamicTdee == null ? "-- kcal" : `${data.scienceMetrics.dynamicTdee.toLocaleString()} kcal`}
          sub="過去14日の実測データから計算"
          color="text-purple-400"
        />
        <ScienceCard
          icon={<Flame size={15} />}
          label="計算上の純脂肪カット量"
          value={data.scienceMetrics.estimatedFatMassCutKg == null ? "-- kg" : `${data.scienceMetrics.estimatedFatMassCutKg.toFixed(2)} kg`}
          sub="水分を除く純脂肪の減量分"
          color="text-orange-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatBadge
          label="現在値"
          value={`${data.currentWeight} kg`}
          sub={`生測定 / 開始比 -${lost.toFixed(1)}kg`}
          color="text-amber-400"
        />
        <StatBadge
          label="総合進捗"
          value={`${progressPct}%`}
          sub={`75kgまで あと ${remaining.toFixed(1)}kg`}
          color="text-emerald-400"
        />
      </div>

      {/* Recovery & muscle protection indicators */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={15} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-200">筋肉保護インジケーター</h2>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <RecoveryCard
            icon={<Moon size={14} />}
            title="睡眠アナボリック"
            value={recovery.sleepStatus}
            sub={recovery.sleepHours == null ? 'K列の睡眠報告待ち' : `${recovery.sleepHours.toFixed(1)}時間`}
            tone={sleepTone}
          />
          <RecoveryCard
            icon={<RotateCcw size={14} />}
            title="ディロード"
            value={recovery.deloadRecommended ? '💡 ディロード推奨週' : '通常トレーニング週'}
            sub={`${recovery.consecutiveTrainingWeeks}週連続 / 推奨時はセット数50%`}
            tone={recovery.deloadRecommended ? 'amber' : 'blue'}
          />
          <RecoveryCard
            icon={<Timer size={14} />}
            title="有酸素FatMax"
            value={recovery.cardioOverLimit ? '⚠️ 有酸素過剰による筋分解干渉注意' : `${recovery.weeklyCardioMinutes} / ${recovery.weeklyCardioLimit}分`}
            sub="1回30〜45分、週3〜4回 LISS/水中歩行"
            tone={cardioTone}
            meter={{ value: recovery.weeklyCardioMinutes, limit: recovery.weeklyCardioLimit }}
          />
          <RecoveryCard
            icon={<Beef size={14} />}
            title="LBMタンパク質"
            value={`${data.today.protein.actual}g / ${recovery.proteinTargetMin}〜${recovery.proteinTargetMax}g`}
            sub={`LBM ${recovery.lbmKg}kg × 2.2〜2.5g/kg`}
            tone={proteinTone}
            meter={{ value: data.today.protein.actual, limit: recovery.proteinTargetMin }}
          />
        </div>
      </div>

      {/* Weight chart */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-200">体重推移と目標ガイド</h2>
          </div>
          <div className="flex flex-wrap justify-end gap-2 text-[9px]">
            <span className="flex items-center gap-1 text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              実測
            </span>
            <span className="flex items-center gap-1 text-cyan-300">
              <span className="w-4 border-t-2 border-cyan-300" />
              14日EMA
            </span>
            <span className="flex items-center gap-1 text-violet-300">
              <span className="w-4 border-t border-violet-300 border-dashed" />
              目標ガイド
            </span>
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

      {/* Roadmap */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Route size={15} className="text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-200">3 Phase 減量ロードマップ</h2>
        </div>
        <PhaseRoadmap phases={data.roadmapPhases} />
      </div>

      {/* Nutrition & Steps */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={15} className="text-orange-400" />
          <h2 className="text-sm font-semibold text-slate-200">本日の栄養＆歩数</h2>
        </div>
        <NutritionMeters today={data.today} />
      </div>

      {/* Morning AI plan */}
      <div className="bg-[#111827] border border-yellow-500/25 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-yellow-300" />
            <h2 className="text-sm font-semibold text-slate-200">今日のAI計画</h2>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            data.morningSync.aiPlanReady
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          }`}>
            {data.morningSync.aiPlanReady ? '朝計画 確定' : '朝計画 待ち'}
          </span>
        </div>

        {data.aiPlan ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 font-bold text-yellow-300">
                {data.aiPlan.date}
              </span>
              {data.aiPlan.split && (
                <span className="rounded-full border border-yellow-500/30 px-2 py-0.5 text-yellow-200">
                  {data.aiPlan.split}
                </span>
              )}
              {data.aiPlan.place && (
                <span className="rounded-full border border-red-500/30 px-2 py-0.5 text-red-200">
                  {data.aiPlan.place}
                </span>
              )}
            </div>
            {data.aiPlan.exercises && data.aiPlan.exercises.length > 0 ? (
              <div className="space-y-2">
                {data.aiPlan.exercises.slice(0, 3).map((ex, i) => (
                  <div key={`${ex.name}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-[#0f1a2b] px-3 py-2">
                    <span className="min-w-0 truncate text-xs font-bold text-slate-100">{ex.name}</span>
                    <span className="shrink-0 text-[10px] text-yellow-300">
                      {ex.targetWeight}kg × {ex.targetReps}回
                    </span>
                  </div>
                ))}
                {data.aiPlan.exercises.length > 3 && (
                  <p className="text-[10px] text-slate-500">他 {data.aiPlan.exercises.length - 3} 種目は筋トレタブで確認できます</p>
                )}
              </div>
            ) : (
              <p className="whitespace-pre-line text-xs leading-relaxed text-slate-300">{data.aiPlan.rawText}</p>
            )}
            <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Dumbbell size={11} />
              筋トレタブでAI計画を適用して記録できます
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
            朝食後にGemini Sparkへ報告すると、今日の計画がここに表示されます。
          </p>
        )}
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

    </div>
  );
}
