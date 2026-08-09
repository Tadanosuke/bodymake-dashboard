export interface WeightEntry {
  date: string;
  weight?: number;
  predicted?: number;
  ideal: number;
}

export interface LogEntry {
  date: string;
  weight: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  steps: number;
  workout: string;
}

export interface Milestone {
  weight: number;
  label: string;
  idealDate: string;
  achieved: boolean;
  achievedDate?: string;
}

export interface TodayMetrics {
  calories: { actual: number; target: number };
  protein:  { actual: number; target: number };
  fat:      { actual: number; target: number };
  carbs:    { actual: number; target: number };
  steps:    { actual: number; target: number };
}

/** Gemini が指定した1セット分の内訳 */
export interface AIPlanSet {
  weight: number;
  count:  number;   // ダンベルの個数 (2 = 両手)
  reps:   number;
  label:  string;   // アップ / メイン1 / バックオフ / パンプ など
}

export interface AIPlanExercise {
  name:          string;
  muscle:        string;
  sets:          number;
  targetWeight:  number;
  targetReps:    number;
  restSeconds:   number;
  setsDetail?:   string;       // "7.5kg*2*10(アップ), 24kg*2*8(メイン1)" 生テキスト
  setList?:      AIPlanSet[];  // 上記をパースしたもの
}

export interface AIPlan {
  date:       string;
  rawText:    string;
  split?:     string;   // Push / Pull / Legs など
  place?:     string;   // 自宅 / 赤坂 など
  exercises?: AIPlanExercise[];
}

export interface DashboardData {
  isEmpty?: boolean;
  currentWeight:     number;
  phaseTarget:       number;
  finalTarget:       number;
  startWeight:       number;
  startDate:         string;
  phaseTargetDate:   string;
  finalTargetDate:   string;
  daysToPhaseTarget: number;
  daysToFinalTarget: number;
  weeklyLossRate:    number;
  weightHistory:     WeightEntry[];
  milestones:        Milestone[];
  today:             TodayMetrics;
  logs:              LogEntry[];
  aiPlan?:           AIPlan | null;
}
