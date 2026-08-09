// ダッシュボードの集計ロジック。
// Firestore はユーザー認証済みのブラウザ側でしか読めないため（サーバーの
// serverless 関数から client SDK を呼ぶとルールで拒否され、かつ数十秒ハングする）、
// マージと集計はここに切り出してクライアントで実行する。
import type { DashboardData, WeightEntry, LogEntry, AIPlan } from './types';
import type { DailyLogFS } from './firestore';

export const START_WEIGHT      = 92.5;
export const START_DATE        = '2026-07-01';
export const FINAL_TARGET      = 75.0;
export const PHASE_TARGET      = 87.0;
export const PHASE_TARGET_DATE = '2026-09-15';
export const FINAL_TARGET_DATE = '2027-01-31';

export interface GasLog {
  date: string;
  weight?: number; calories?: number; protein?: number;
  fat?: number; carbs?: number; steps?: number; workout?: string;
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
  return Math.max(START_WEIGHT - (daysSinceStart / 214) * 17.5, FINAL_TARGET);
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
        calories: gas?.calories ?? 0,
        protein:  gas?.protein  ?? 0,
        fat:      gas?.fat      ?? 0,
        carbs:    gas?.carbs    ?? 0,
      };
    });

  // データがまったく無い新規ユーザー → 空状態（モックは返さない）
  if (logs.every(l => !l.weight && !l.calories)) {
    return {
      ...BASE,
      isEmpty:           true,
      currentWeight:     0,
      daysToPhaseTarget: daysTo(PHASE_TARGET_DATE),
      daysToFinalTarget: daysTo(FINAL_TARGET_DATE),
      weightHistory:     [],
      milestones:        milestones(0),
      today: {
        calories: { actual: 0, target: 1800 },
        protein:  { actual: 0, target: 150 },
        fat:      { actual: 0, target: 55 },
        carbs:    { actual: 0, target: 180 },
        steps:    { actual: 0, target: 8000 },
      },
      logs: [],
      aiPlan,
    };
  }

  const withWeight = logs.filter(l => l.weight > 0).slice(0, 30).reverse();
  const weightHistory: WeightEntry[] = withWeight.map(l => ({
    date:   l.date.slice(5).replace('-', '/'),
    weight: l.weight,
    ideal:  computeIdeal(l.date),
  }));

  // 12週先までの予測線
  if (withWeight.length > 0) {
    const last       = withWeight[withWeight.length - 1];
    const lastDate   = new Date(last.date);
    const lossPerDay = 0.55 / 7;
    for (let w = 1; w <= 12; w++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + w * 7);
      const ds = d.toISOString().slice(0, 10);
      weightHistory.push({
        date:      ds.slice(5).replace('-', '/'),
        predicted: Math.max(last.weight - lossPerDay * w * 7, FINAL_TARGET),
        ideal:     computeIdeal(ds),
      });
    }
  }

  const currentWeight = withWeight.length > 0 ? withWeight[withWeight.length - 1].weight : START_WEIGHT;
  const todayLog = logs[0];

  return {
    ...BASE,
    currentWeight,
    daysToPhaseTarget: daysTo(PHASE_TARGET_DATE),
    daysToFinalTarget: daysTo(FINAL_TARGET_DATE),
    weightHistory,
    milestones: milestones(currentWeight),
    today: {
      calories: { actual: todayLog?.calories ?? 0, target: 1800 },
      protein:  { actual: todayLog?.protein  ?? 0, target: 150 },
      fat:      { actual: todayLog?.fat      ?? 0, target: 55 },
      carbs:    { actual: todayLog?.carbs    ?? 0, target: 180 },
      steps:    { actual: todayLog?.steps    ?? 0, target: 8000 },
    },
    logs,
    aiPlan,
  };
}
