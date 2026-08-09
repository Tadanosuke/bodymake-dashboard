// スプレッドシート I列「筋トレ部位・メニュー」のテキストを構造化する。
//
// 想定する3種類の書式:
//   1. 現行アプリ  `[胸]ベンチプレス: 60kg×10回, 65kg×8回 ｜ 計2セット/負荷量1120kg`
//   2. 旧アプリ    `[胸]ベンチプレス: 1.60kg×10, 2.65kg×8`  ← 先頭の "1." はセット番号
//   3. Gemini/手書 `ダンベルプレス［8kgx10, 13.5kgx5, 24kgx5(6回目潰れ)］（計3セット/負荷量…）`
//
// 2 と 3 は「重量の小数点」と「セット番号」が区別できないため、現行アプリでは
// 必ず `回` を付けて書く（formatWorkoutForSheet 参照）。ここでは `回` 付きを
// 優先して読み、見つからなければ旧形式として連番プレフィックスを剥がす。

import { guessMuscle } from './exercises';

export interface ParsedSet      { weight: number; reps: number }
export interface ParsedExercise { muscle: string; name: string; sets: ParsedSet[]; volume: number }
export interface ParsedWorkout  { exercises: ParsedExercise[]; totalVolume: number; setCount: number }

const STRICT = /(\d+(?:\.\d+)?)\s*kg\s*[×xX*]\s*(\d+)\s*回/g;
const LOOSE  = /(\d+(?:\.\d+)?)\s*kg\s*[×xX*]\s*(\d+)/;

function parseSets(setsPart: string): ParsedSet[] {
  const strict = Array.from(setsPart.matchAll(STRICT));
  if (strict.length > 0) {
    return strict.map(m => ({ weight: parseFloat(m[1]), reps: parseInt(m[2], 10) }));
  }

  // 旧形式・Gemini形式。トークンの先頭にセット番号(1. 2. 3. …)が付くことがある。
  return setsPart
    .split(/[,、]/)
    .map(t => t.trim())
    .filter(Boolean)
    .map((token, i) => {
      const stripped = token.replace(new RegExp(`^${i + 1}\\.(?=\\d)`), '');
      const m = stripped.match(LOOSE);
      return m ? { weight: parseFloat(m[1]), reps: parseInt(m[2], 10) } : null;
    })
    .filter((s): s is ParsedSet => s !== null);
}

export function parseSheetWorkout(raw: unknown): ParsedWorkout | null {
  const text = String(raw ?? '').split('｜')[0].trim();
  if (!text) return null;

  const chunks = text.split(/\s*\/\s*|、(?=\s*[^\d])/).map(c => c.trim()).filter(Boolean);
  const exercises: ParsedExercise[] = [];

  for (const chunk of chunks) {
    const tag    = chunk.match(/^\[([^\]]{1,6})\]\s*/);   // [胸] のような部位タグ
    const body   = tag ? chunk.slice(tag[0].length) : chunk;
    const sepIdx = body.search(/[:：［【]/);

    const name     = (sepIdx >= 0 ? body.slice(0, sepIdx) : body.replace(/[（(].*$/, '')).trim();
    const setsPart = sepIdx >= 0 ? body.slice(sepIdx + 1) : body;
    if (!name) continue;

    const sets = parseSets(setsPart);
    if (sets.length === 0) continue;

    exercises.push({
      muscle: tag ? tag[1] : guessMuscle(name),
      name,
      sets,
      volume: sets.reduce((s, x) => s + x.weight * x.reps, 0),
    });
  }

  if (exercises.length === 0) return null;
  return {
    exercises,
    totalVolume: exercises.reduce((s, e) => s + e.volume, 0),
    setCount:    exercises.reduce((s, e) => s + e.sets.length, 0),
  };
}
