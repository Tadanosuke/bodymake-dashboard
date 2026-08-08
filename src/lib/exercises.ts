export const MUSCLES = ['胸', '背中', '脚', '肩', '腕', '腹筋', '有酸素'] as const;
export type Muscle = typeof MUSCLES[number];
export const ALL_TABS = ['ALL', ...MUSCLES] as const;

export const PRESETS: Record<Muscle, string[]> = {
  胸:   ['ベンチプレス', 'ダンベルプレス', 'インクラインプレス', 'フライ', 'ケーブルクロスオーバー', 'ディップス', 'プッシュアップ'],
  背中:  ['デッドリフト', 'ラットプルダウン', 'チンニング', 'ベントオーバーロウ', 'シーテッドロウ', 'Tバーロウ', 'ワンハンドロウ'],
  脚:   ['スクワット', 'レッグプレス', 'ランジ', 'レッグカール', 'レッグエクステンション', 'カーフレイズ', 'ヒップアブダクション', 'スミスマシンスクワット'],
  肩:   ['ショルダープレス', 'サイドレイズ', 'フロントレイズ', 'リアデルトフライ', 'アップライトロウ', 'フェイスプル'],
  腕:   ['バーベルカール', 'ダンベルカール', 'ハンマーカール', 'プリーチャーカール', 'トライセプスプレスダウン', 'スカルクラッシャー'],
  腹筋:  ['クランチ', 'レッグレイズ', 'プランク', 'ロシアンツイスト', 'バイシクルクランチ', 'ケーブルクランチ'],
  有酸素: ['ウォーキング', 'ランニング', 'HIIT', 'エアロバイク', 'なわとび', 'ステッパー'],
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
  id:         string;
  muscle:     Muscle;
  name:       string;
  sets:       WorkoutSet[];
  lastRecord?: LastRecord;
}

const STORAGE_KEY = 'bodymake_workout_history';

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
        h[ex.name] = { date, sets: valid.map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })) };
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
        .map((s, i) => `${i + 1}. ${s.weight || 0}kg×${s.reps || 0}`)
        .join(', ');
      return `[${ex.muscle}] ${ex.name}: ${sets}`;
    })
    .join(' / ');
}

export const MUSCLE_COLORS: Record<Muscle, string> = {
  胸:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  背中:  'bg-green-500/20 text-green-300 border-green-500/30',
  脚:   'bg-orange-500/20 text-orange-300 border-orange-500/30',
  肩:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  腕:   'bg-pink-500/20 text-pink-300 border-pink-500/30',
  腹筋:  'bg-red-500/20 text-red-300 border-red-500/30',
  有酸素: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};
