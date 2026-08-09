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

export interface AIPlanExercise {
  name:          string;
  muscle:        string;
  sets:          number;
  targetWeight:  number;
  targetReps:    number;
  restSeconds:   number;
  setsDetail?:   string;  // "20kg×10, 40kg×8, 80kg×2" などGemini生成の詳細
}

export interface AIPlan {
  date:       string;
  rawText:    string;
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
