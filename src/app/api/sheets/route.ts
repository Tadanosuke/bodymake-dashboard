import { NextResponse } from "next/server";
import { getRecentDailyLogs } from "@/lib/firestore";
import type { DashboardData, WeightEntry, LogEntry } from "@/lib/types";

// 各ユーザーは自分のスプレッドシート(GASのURL)を設定画面から登録する。
// 未設定なら Firestore のみで動作し、Gemini連携(カロリー/AI計画)は無効。
function resolveEndpoint(param: string | null): string | null {
  const url = (param || '').trim();
  return /^https:\/\/script\.google\.com\//.test(url) ? url : null;
}

const START_WEIGHT      = 92.5;
const START_DATE        = '2026-07-01';
const FINAL_TARGET      = 75.0;
const PHASE_TARGET      = 87.0;
const PHASE_TARGET_DATE = '2026-09-15';
const FINAL_TARGET_DATE = '2027-01-31';

function daysTo(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function computeIdeal(dateStr: string): number {
  const daysSinceStart = (new Date(dateStr).getTime() - new Date(START_DATE).getTime()) / 86400000;
  return Math.max(START_WEIGHT - (daysSinceStart / 214) * 17.5, FINAL_TARGET);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid') ?? '';
  const GAS_ENDPOINT = resolveEndpoint(searchParams.get('gas'));

  // 1. Fetch this user's Firebase daily logs
  const fsLogs = uid ? await getRecentDailyLogs(uid, 60) : [];

  // 2. Fetch GAS calorie/PFC/AI plan data (Gemini-written, shared spreadsheet)
  interface GasLog { date: string; weight?: number; calories?: number; protein?: number; fat?: number; carbs?: number; steps?: number; workout?: string; }
  interface GasResponse { logs?: GasLog[]; aiPlan?: DashboardData['aiPlan'] }
  let gasData: GasResponse = {};
  if (GAS_ENDPOINT) {
    try {
      const res = await fetch(`${GAS_ENDPOINT}?action=getDashboard`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && !json.error) gasData = json;
      }
    } catch {}
  }
  const gasLogs: GasLog[] = gasData.logs || [];

  // 3. Merge: Firebase authoritative for user-written fields; GAS for Gemini calories
  const allDates = new Set([
    ...fsLogs.map(l => l.date),
    ...gasLogs.map(l => l.date).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)),
  ]);

  const mergedLogs: LogEntry[] = Array.from(allDates)
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

  // New user with no data — return empty state (not mock data)
  if (mergedLogs.every(l => !l.weight && !l.calories)) {
    return NextResponse.json({
      isEmpty: true,
      currentWeight:     0,
      phaseTarget:       PHASE_TARGET,
      finalTarget:       FINAL_TARGET,
      startWeight:       START_WEIGHT,
      startDate:         START_DATE,
      phaseTargetDate:   PHASE_TARGET_DATE,
      finalTargetDate:   FINAL_TARGET_DATE,
      daysToPhaseTarget: daysTo(PHASE_TARGET_DATE),
      daysToFinalTarget: daysTo(FINAL_TARGET_DATE),
      weeklyLossRate:    0.55,
      weightHistory:     [],
      milestones: [
        { weight: 87, label: 'Phase 1',  idealDate: '2026-09-15', achieved: false },
        { weight: 85, label: 'Phase 2',  idealDate: '2026-10-15', achieved: false },
        { weight: 82, label: 'Phase 3',  idealDate: '2026-11-05', achieved: false },
        { weight: 80, label: 'Phase 4',  idealDate: '2026-11-25', achieved: false },
        { weight: 77, label: 'Phase 5',  idealDate: '2026-12-20', achieved: false },
        { weight: 75, label: '最終目標', idealDate: '2027-01-31', achieved: false },
      ],
      today: {
        calories: { actual: 0, target: 1800 },
        protein:  { actual: 0, target: 150 },
        fat:      { actual: 0, target: 55 },
        carbs:    { actual: 0, target: 180 },
        steps:    { actual: 0, target: 8000 },
      },
      logs: [],
      aiPlan: gasData.aiPlan ?? null,
    } satisfies DashboardData);
  }

  // 4. Build weight history from entries that have weight
  const withWeight = mergedLogs.filter(l => l.weight > 0).slice(0, 30).reverse();
  const weightHistory: WeightEntry[] = withWeight.map(l => ({
    date:   l.date.slice(5).replace('-', '/'),
    weight: l.weight,
    ideal:  computeIdeal(l.date),
  }));

  // Add prediction points (12 weeks out)
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
  const todayLog = mergedLogs[0] ?? {};

  return NextResponse.json({
    currentWeight,
    phaseTarget:       PHASE_TARGET,
    finalTarget:       FINAL_TARGET,
    startWeight:       START_WEIGHT,
    startDate:         START_DATE,
    phaseTargetDate:   PHASE_TARGET_DATE,
    finalTargetDate:   FINAL_TARGET_DATE,
    daysToPhaseTarget: daysTo(PHASE_TARGET_DATE),
    daysToFinalTarget: daysTo(FINAL_TARGET_DATE),
    weeklyLossRate:    0.55,
    weightHistory,
    milestones: [
      { weight: 87, label: 'Phase 1',  idealDate: '2026-09-15', achieved: currentWeight <= 87 },
      { weight: 85, label: 'Phase 2',  idealDate: '2026-10-15', achieved: currentWeight <= 85 },
      { weight: 82, label: 'Phase 3',  idealDate: '2026-11-05', achieved: currentWeight <= 82 },
      { weight: 80, label: 'Phase 4',  idealDate: '2026-11-25', achieved: currentWeight <= 80 },
      { weight: 77, label: 'Phase 5',  idealDate: '2026-12-20', achieved: currentWeight <= 77 },
      { weight: 75, label: '最終目標', idealDate: '2027-01-31', achieved: currentWeight <= 75 },
    ],
    today: {
      calories: { actual: todayLog.calories ?? 0, target: 1800 },
      protein:  { actual: todayLog.protein  ?? 0, target: 150 },
      fat:      { actual: todayLog.fat      ?? 0, target: 55 },
      carbs:    { actual: todayLog.carbs    ?? 0, target: 180 },
      steps:    { actual: todayLog.steps    ?? 0, target: 8000 },
    },
    logs: mergedLogs,
    aiPlan: gasData.aiPlan ?? null,
  } satisfies DashboardData);
}
