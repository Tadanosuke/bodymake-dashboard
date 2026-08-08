// ダンベルフライは絶対NG — このファイルのどこにも追加しないこと
export const MUSCLES = ['胸', '背中', '脚', '肩', '腕', 'お尻', '腹筋', '有酸素'] as const;
export type Muscle = typeof MUSCLES[number];
export const ALL_TABS = ['ALL', ...MUSCLES] as const;

export type Store = '自宅・牛久店' | '赤坂店';

// 特定店舗でのみ利用可能な種目
const STORE_ONLY_MAP: Record<string, Store> = {
  'レッグカール':     '自宅・牛久店', // 赤坂店にはない
  'アシストチンニング': '赤坂店',     // 自宅・牛久店にはない
};

export function filterByStore(exercises: string[], store: Store): string[] {
  return exercises.filter(name => {
    const storeOnly = STORE_ONLY_MAP[name];
    return !storeOnly || storeOnly === store;
  });
}

// デフォルト種目（CLAUDE.md 定義準拠）
export const PRESETS: Record<Muscle, string[]> = {
  胸: [
    'インクラインダンベルプレス',
    'ペックフライ',
    'ベンチプレス',
    'チェストプレス',
    // ダンベルフライは意図的に除外
  ],
  背中: [
    'ラットプルダウン',
    'シーテッドロー',
    'アシストチンニング', // 赤坂店のみ
    'ダンベルローイング',
    'デッドリフト',
  ],
  脚: [
    'バーベルスクワット',
    'レッグカール',     // 自宅・牛久店のみ
    'レッグエクステンション',
    'レッグプレス',
    'ブルガリアンスクワット',
  ],
  肩: [
    'サイドレイズ',
    'オーバーヘッドプレス(バーベル)',
    'スミスショルダープレス',
    'ダンベルショルダープレス',
    'アーノルドプレス',
  ],
  腕: [
    'EZバーカール',
    'アームカール',
    'ハンマーカール',
    'ケーブルカール',
    'ケーブルプッシュダウン',
    'フレンチプレス',
    'オーバーヘッドケーブルトライセプスエクステンション',
  ],
  お尻: [
    'アダクター',
    'アブダクション',
    'ヒップスラスト',
  ],
  腹筋: [
    'クランチ',
    'レッグレイズ',
    'プランク',
    'ロシアンツイスト',
    'バイシクルクランチ',
  ],
  有酸素: [
    'ウォーキング（15度傾斜/4km/h/15-20分）',
    'ランニング',
    'HIIT',
    'エアロバイク',
  ],
};

export interface WorkoutSet {
  weight: string;
  reps:   string;
}

export interface LastRecord {
  date: string;
  sets: Array<{ weight: number; reps: number }>;
}

export interface ExerciseSession {
  id:          string;
  muscle:      Muscle;
  name:        string;
  sets:        WorkoutSet[];
  lastRecord?: LastRecord;
}

const STORAGE_KEY      = 'bodymake_workout_history';
export const STORE_KEY = 'bodymake_store';

export function getLastRecord(name: string): LastRecord | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const h = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, LastRecord>;
    return h[name];
  } catch { return undefined; }
}

export function saveWorkoutHistory(exercises: ExerciseSession[], date: string) {
  if (typeof window === 'undefined') return;
  try {
    const h = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, LastRecord>;
    exercises.forEach(ex => {
      const valid = ex.sets.filter(s => s.weight && s.reps);
      if (valid.length > 0) {
        h[ex.name] = {
          date,
          sets: valid.map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })),
        };
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
  } catch {}
}

export function calc1RM(weight: string, reps: string): string {
  const w = parseFloat(weight);
  const r = parseInt(reps);
  if (!w || !r || r <= 0) return '-';
  return (w * (1 + r / 30)).toFixed(1);
}

export function formatWorkoutForSheet(exercises: ExerciseSession[]): string {
  return exercises
    .filter(ex => ex.sets.some(s => s.weight || s.reps))
    .map(ex => {
      const sets = ex.sets
        .filter(s => s.weight || s.reps)
        .map((s, i) => `${i + 1}.${s.weight || 0}kg×${s.reps || 0}`)
        .join(', ');
      return `[${ex.muscle}]${ex.name}: ${sets}`;
    })
    .join(' / ');
}

export const MUSCLE_COLORS: Record<Muscle, string> = {
  胸:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  背中:  'bg-green-500/20 text-green-300 border-green-500/30',
  脚:   'bg-orange-500/20 text-orange-300 border-orange-500/30',
  肩:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  腕:   'bg-pink-500/20 text-pink-300 border-pink-500/30',
  お尻:  'bg-rose-500/20 text-rose-300 border-rose-500/30',
  腹筋:  'bg-red-500/20 text-red-300 border-red-500/30',
  有酸素: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};
