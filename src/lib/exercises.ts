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

// ─── ユーザー追加のカスタム種目 (localStorage に永続化) ──────────────────────
const CUSTOM_KEY = 'bodymake_custom_exercises';

/** 部位ごとのカスタム種目一覧 */
export function getCustomExercises(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}') as Record<string, string[]>;
  } catch { return {}; }
}

/** カスタム種目を追加。既に存在すれば何もしない */
export function addCustomExercise(muscle: Muscle, name: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    const all = getCustomExercises();
    const list = all[muscle] || [];
    if (list.includes(trimmed) || PRESETS[muscle].includes(trimmed)) return;
    all[muscle] = [...list, trimmed];
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
  } catch {}
}

export function removeCustomExercise(muscle: Muscle, name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const all = getCustomExercises();
    all[muscle] = (all[muscle] || []).filter(n => n !== name);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
  } catch {}
}

/** プリセット + カスタムを結合した、その部位で選べる全種目 */
export function getExercisesFor(muscle: Muscle, store: Store): string[] {
  const custom = getCustomExercises()[muscle] || [];
  return [...filterByStore(PRESETS[muscle], store), ...custom];
}

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

/**
 * スプレッドシート I列 に書く文字列。
 * 形式: `[胸]ベンチプレス: 60kg×10回, 65kg×8回 / [腕]アームカール: 12kg×12回 ｜ 計3セット/負荷量1996kg`
 * `回` を必ず付けるのは、旧形式（`1.60kg×10` のようにセット番号が前置され、
 * 重量の小数点と区別が付かない）と機械的に見分けるため。parseSheetWorkout と対。
 */
export function formatWorkoutForSheet(exercises: ExerciseSession[]): string {
  const valid = exercises.filter(ex => ex.sets.some(s => s.weight && s.reps));
  if (valid.length === 0) return '';

  const body = valid.map(ex => {
    const sets = ex.sets
      .filter(s => s.weight && s.reps)
      .map(s => `${parseFloat(s.weight)}kg×${parseInt(s.reps)}回`)
      .join(', ');
    return `[${ex.muscle}]${ex.name}: ${sets}`;
  }).join(' / ');

  const setCount = valid.reduce((n, ex) => n + ex.sets.filter(s => s.weight && s.reps).length, 0);
  const volume   = valid.reduce((sum, ex) =>
    sum + ex.sets.reduce((s2, s) => s2 + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0);

  return `${body} ｜ 計${setCount}セット/負荷量${Math.round(volume)}kg`;
}

/** 種目名から部位を推定する（Gemini は Push/Pull/Legs 単位でしか部位を返さないため） */
export function guessMuscle(name: string): Muscle {
  for (const m of MUSCLES) {
    if (PRESETS[m].some(p => name.includes(p) || p.includes(name))) return m;
  }
  // 「プレスダウン」が「プレス」で胸に落ちないよう、腕・肩・脚を先に判定する
  if (/カール|トライセップス|トライセプス|フレンチ|プッシュダウン|プレスダウン|キックバック/.test(name)) return '腕';
  if (/ショルダー|サイドレイズ|リアレイズ|フロントレイズ|アーノルド/.test(name)) return '肩';
  if (/スクワット|レッグ|カーフ|ランジ/.test(name))                   return '脚';
  if (/ベンチ|チェスト|プレス|ペック/.test(name))                     return '胸';
  if (/ロー|ラット|プル|デッド|チンニング/.test(name))                return '背中';
  if (/エクステンション/.test(name))                                  return '腕';
  if (/クランチ|プランク|ツイスト|アブ/.test(name))                   return '腹筋';
  if (/ヒップ|アダクター|アブダクション/.test(name))                  return 'お尻';
  if (/ウォーキング|ランニング|バイク|HIIT/.test(name))               return '有酸素';
  return '胸';
}

// ─── セッション履歴 (カレンダー・月間負荷量用) ──────────────────────────────

const SESSIONS_KEY = 'bodymake_sessions';

interface StoredSession {
  exercises: Array<{ muscle: string; name: string; sets: Array<{ weight: number; reps: number }> }>;
  totalVolume: number;
}

export function saveWorkoutSession(exercises: ExerciseSession[], date: string) {
  if (typeof window === 'undefined') return;
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}') as Record<string, StoredSession>;
    const valid = exercises.filter(ex => ex.sets.some(s => s.weight && s.reps));
    if (valid.length === 0) return;
    const totalVolume = valid.reduce((sum, ex) =>
      sum + ex.sets.reduce((s2, s) => s2 + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0);
    sessions[date] = {
      exercises: valid.map(ex => ({
        muscle: ex.muscle, name: ex.name,
        sets: ex.sets.filter(s => s.weight && s.reps).map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })),
      })),
      totalVolume,
    };
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {}
}

export function getWorkoutDates(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return Object.keys(JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}'));
  } catch { return []; }
}

/** 月間合計負荷量 (kg) */
export function getMonthlyVolume(year: number, month: number): number {
  if (typeof window === 'undefined') return 0;
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}') as Record<string, StoredSession>;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return Object.entries(sessions)
      .filter(([d]) => d.startsWith(prefix))
      .reduce((s, [, sess]) => s + sess.totalVolume, 0);
  } catch { return 0; }
}

/** トータル合計負荷量 (kg) */
export function getTotalVolume(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}') as Record<string, StoredSession>;
    return Object.values(sessions).reduce((s, sess) => s + sess.totalVolume, 0);
  } catch { return 0; }
}

export function getWorkoutDayCount(): number {
  return getWorkoutDates().length;
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
