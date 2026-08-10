// ダッシュボードの集計ロジック。
// Firestore はユーザー認証済みのブラウザ側でしか読めないため（サーバーの
// serverless 関数から client SDK を呼ぶとルールで拒否され、かつ数十秒ハングする）、
// マージと集計はここに切り出してクライアントで実行する。
import type {
  DashboardData,
  WeightEntry,
  LogEntry,
  AIPlan,
  MorningSyncStatus,
  ScienceMetrics,
  RoadmapPhase,
} from './types';
import type { DailyLogFS } from './firestore';

export const START_WEIGHT      = 90.0;
export const START_DATE        = '2026-07-01';
export const FINAL_TARGET      = 75.0;
export const PHASE_TARGET      = 87.0;
export const PHASE_TARGET_DATE = '2026-09-15';
export const FINAL_TARGET_DATE = '2027-01-31';

const EMA_ALPHA = 0.133;
const KCAL_PER_KG_FAT = 8300;

const ROADMAP_BASE: Omit<RoadmapPhase, 'active' | 'completed' | 'progressPct'>[] = [
  {
    id: 1,
    name: '初期高効率',
    rangeLabel: '90kg -> 84kg',
    startWeight: 90,
    targetWeight: 84,
    targetWeeklyLossPct: 0.8,
    approxWeeklyLossKg: 0.72,
    calories: 2000,
    protein: 155,
    fat: 44,
    carbs: 245,
  },
  {
    id: 2,
    name: 'Vシェイプ加速',
    rangeLabel: '84kg -> 79kg',
    startWeight: 84,
    targetWeight: 79,
    targetWeeklyLossPct: 0.6,
    approxWeeklyLossKg: 0.5,
    calories: 1950,
    protein: 165,
    fat: 43,
    carbs: 225,
    note: 'リフィード表示',
  },
  {
    id: 3,
    name: '極限絞り込み',
    rangeLabel: '79kg -> 75kg',
    startWeight: 79,
    targetWeight: 75,
    targetWeeklyLossPct: 0.5,
    approxWeeklyLossKg: 0.38,
    calories: 1900,
    protein: 175,
    fat: 46,
    carbs: 195,
    note: 'ダイエットブレイク表示',
  },
];

export interface GasLog {
  date: string;
  weight?: number; calories?: number; protein?: number;
  fat?: number; carbs?: number; steps?: number; workout?: string; memo?: string;
}

export interface GasResponse {
  logs?:   GasLog[];
  aiPlan?: AIPlan | null;
  error?:  string;
}

function daysTo(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function computeIdeal(dateStr: string): number {
  const daysSinceStart = (new Date(dateStr).getTime() - new Date(START_DATE).getTime()) / 86400000;
  return Math.max(START_WEIGHT - (daysSinceStart / 214) * (START_WEIGHT - FINAL_TARGET), FINAL_TARGET);
}

function milestones(currentWeight: number) {
  return [
    { weight: 87, label: 'Phase 1',  idealDate: '2026-09-15' },
    { weight: 85, label: 'Phase 2',  idealDate: '2026-10-15' },
    { weight: 82, label: 'Phase 3',  idealDate: '2026-11-05' },
    { weight: 80, label: 'Phase 4',  idealDate: '2026-11-25' },
    { weight: 77, label: 'Phase 5',  idealDate: '2026-12-20' },
    { weight: 75, label: '最終目標', idealDate: '2027-01-31' },
  ].map(m => ({ ...m, achieved: currentWeight > 0 && currentWeight <= m.weight }));
}

const EMPTY_SCIENCE_METRICS: ScienceMetrics = {
  trendWeight: null,
  weeklyBodyWeightChangePct: null,
  dynamicTdee: null,
  estimatedFatMassCutKg: null,
};

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function buildRoadmapPhases(referenceWeight: number): RoadmapPhase[] {
  return ROADMAP_BASE.map((phase) => {
    const totalDrop = phase.startWeight - phase.targetWeight;
    const currentDrop = phase.startWeight - referenceWeight;
    const completed = referenceWeight <= phase.targetWeight;
    const active = referenceWeight <= phase.startWeight && referenceWeight > phase.targetWeight;
    const progressPct = Math.max(0, Math.min(100, (currentDrop / totalDrop) * 100));

    return {
      ...phase,
      active,
      completed,
      progressPct: completed ? 100 : round(progressPct, 0),
    };
  });
}

function computeTrendHistory(withWeight: LogEntry[]): WeightEntry[] {
  let previousTrend: number | null = null;
  return withWeight.map((l) => {
    const trend = previousTrend == null
      ? l.weight
      : EMA_ALPHA * l.weight + (1 - EMA_ALPHA) * previousTrend;
    previousTrend = trend;
    return {
      date: l.date.slice(5).replace('-', '/'),
      isoDate: l.date,
      weight: l.weight,
      trendWeight: round(trend),
      ideal: computeIdeal(l.date),
    };
  });
}

function trendOnOrBefore(weightHistory: WeightEntry[], dateStr: string): number | undefined {
  for (let i = weightHistory.length - 1; i >= 0; i--) {
    const entry = weightHistory[i];
    if (entry.isoDate && entry.isoDate <= dateStr && entry.trendWeight != null) return entry.trendWeight;
  }
  return undefined;
}

function computeScienceMetrics(logsDesc: LogEntry[], weightHistory: WeightEntry[]): ScienceMetrics {
  const latestEntry = weightHistory.at(-1);
  const latestTrend = latestEntry?.trendWeight;
  const latestDate = latestEntry?.isoDate;
  const trend7DaysAgo = latestDate ? trendOnOrBefore(weightHistory, addDays(latestDate, -7)) : undefined;
  const trend14DaysAgo = latestDate ? trendOnOrBefore(weightHistory, addDays(latestDate, -14)) : undefined;
  const intakeStartDate = latestDate ? addDays(latestDate, -13) : '';

  const recent14 = logsDesc
    .filter((l) => l.calories > 0 && (!latestDate || (l.date >= intakeStartDate && l.date <= latestDate)))
    .slice(0, 14);
  const avgIntake14 = recent14.length > 0
    ? recent14.reduce((sum, l) => sum + l.calories, 0) / recent14.length
    : null;

  const dynamicTdee = latestTrend != null && trend14DaysAgo != null && avgIntake14 != null
    ? avgIntake14 - ((KCAL_PER_KG_FAT * (latestTrend - trend14DaysAgo)) / 14)
    : null;

  const estimatedDeficit = dynamicTdee != null
    ? logsDesc
        .filter((l) => l.calories > 0)
        .reduce((sum, l) => sum + Math.max(dynamicTdee - l.calories, 0), 0)
    : 0;

  return {
    trendWeight: latestTrend ?? null,
    weeklyBodyWeightChangePct: latestTrend != null && trend7DaysAgo
      ? round(((latestTrend - trend7DaysAgo) / trend7DaysAgo) * 100, 2)
      : null,
    dynamicTdee: dynamicTdee != null ? Math.round(dynamicTdee) : null,
    estimatedFatMassCutKg: dynamicTdee != null ? round(estimatedDeficit / KCAL_PER_KG_FAT, 2) : null,
  };
}

function dateKey(d = new Date()): string {
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function memoPart(memo: string, key: string): string {
  const found = String(memo || '')
    .split(' / ')
    .map(s => s.trim())
    .find(s => s.startsWith(`${key}:`));
  return found ? found.slice(key.length + 1).trim() : '';
}

function buildMorningSync(logs: LogEntry[], aiPlan: AIPlan | null): MorningSyncStatus {
  const today = dateKey();
  const yesterday = addDays(today, -1);
  const todayLog = logs.find(l => l.date === today);
  const yesterdayLog = logs.find(l => l.date === yesterday);
  const memo = todayLog?.memo ?? '';
  const sleep = memoPart(memo, '睡眠');
  const doms = memoPart(memo, '筋肉痛');
  const todayPlan = memoPart(memo, '今日');
  const breakfast = memoPart(memo, '朝食');
  return {
    date: today,
    yesterdayDate: yesterday,
    yesterdaySteps: yesterdayLog?.steps ?? 0,
    memo,
    sleep,
    doms,
    todayPlan,
    breakfast,
    hasMorningReport: Boolean(sleep || doms || todayPlan || breakfast || (yesterdayLog?.steps ?? 0) > 0),
    aiPlanReady: aiPlan?.date === today,
    aiPlanDate: aiPlan?.date,
  };
}

const BASE = {
  phaseTarget:       PHASE_TARGET,
  finalTarget:       FINAL_TARGET,
  startWeight:       START_WEIGHT,
  startDate:         START_DATE,
  phaseTargetDate:   PHASE_TARGET_DATE,
  finalTargetDate:   FINAL_TARGET_DATE,
  weeklyLossRate:    0.55,
};

export function buildDashboard(
  fsLogs:  DailyLogFS[],
  gasData: GasResponse,
): DashboardData {
  const gasLogs = gasData.logs ?? [];
  const aiPlan  = gasData.aiPlan ?? null;

  // Firestore(本人の入力)を優先し、カロリー系は Gemini が書いたシートから取る
  const allDates = new Set([
    ...fsLogs.map(l => l.date),
    ...gasLogs.map(l => l.date).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)),
  ]);

  const logs: LogEntry[] = Array.from(allDates)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 30)
    .map(date => {
      const fs  = fsLogs.find(l => l.date === date);
      const gas = gasLogs.find(l => l.date === date);
      return {
        date,
        weight:   fs?.weight   ?? gas?.weight   ?? 0,
        steps:    fs?.steps    ?? gas?.steps    ?? 0,
        workout:  fs?.workout  ?? gas?.workout  ?? '',
        memo:     gas?.memo     ?? '',
        calories: gas?.calories ?? 0,
        protein:  gas?.protein  ?? 0,
        fat:      gas?.fat      ?? 0,
        carbs:    gas?.carbs    ?? 0,
      };
    });

  // データがまったく無い新規ユーザー → 空状態（モックは返さない）
  if (logs.every(l => !l.weight && !l.calories && !l.steps && !l.memo && !l.workout) && !aiPlan) {
    const roadmapPhases = buildRoadmapPhases(START_WEIGHT);
    const activePhase = roadmapPhases.find(p => p.active) ?? roadmapPhases[0];
    return {
      ...BASE,
      isEmpty:           true,
      currentWeight:     0,
      daysToPhaseTarget: daysTo(PHASE_TARGET_DATE),
      daysToFinalTarget: daysTo(FINAL_TARGET_DATE),
      weightHistory:     [],
      milestones:        milestones(0),
      scienceMetrics:    EMPTY_SCIENCE_METRICS,
      roadmapPhases,
      today: {
        calories: { actual: 0, target: activePhase.calories },
        protein:  { actual: 0, target: activePhase.protein },
        fat:      { actual: 0, target: activePhase.fat },
        carbs:    { actual: 0, target: activePhase.carbs },
        steps:    { actual: 0, target: 8000 },
      },
      morningSync: buildMorningSync([], aiPlan),
      logs: [],
      aiPlan,
    };
  }

  const withWeight = logs.filter(l => l.weight > 0).slice(0, 30).reverse();
  const weightHistory: WeightEntry[] = computeTrendHistory(withWeight);

  const currentWeight = withWeight.length > 0 ? withWeight[withWeight.length - 1].weight : START_WEIGHT;
  const scienceMetrics = computeScienceMetrics(logs, weightHistory);
  const roadmapWeight = scienceMetrics.trendWeight ?? currentWeight;
  const roadmapPhases = buildRoadmapPhases(roadmapWeight);
  const activePhase = roadmapPhases.find(p => p.active) ?? roadmapPhases.find(p => !p.completed) ?? roadmapPhases[roadmapPhases.length - 1];
  const todayLog = logs.find(l => l.date === dateKey()) ?? logs[0];

  return {
    ...BASE,
    currentWeight,
    daysToPhaseTarget: daysTo(PHASE_TARGET_DATE),
    daysToFinalTarget: daysTo(FINAL_TARGET_DATE),
    weightHistory,
    milestones: milestones(currentWeight),
    scienceMetrics,
    roadmapPhases,
    today: {
      calories: { actual: todayLog?.calories ?? 0, target: activePhase.calories },
      protein:  { actual: todayLog?.protein  ?? 0, target: activePhase.protein },
      fat:      { actual: todayLog?.fat      ?? 0, target: activePhase.fat },
      carbs:    { actual: todayLog?.carbs    ?? 0, target: activePhase.carbs },
      steps:    { actual: todayLog?.steps    ?? 0, target: 8000 },
    },
    morningSync: buildMorningSync(logs, aiPlan),
    logs,
    aiPlan,
  };
}
