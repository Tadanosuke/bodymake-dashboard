// スプレッドシート I列「筋トレ部位・メニュー」のテキストを構造化する。
//
// 実際に入っている書式は4種類ある:
//   1. 現行アプリ  `[胸]ベンチプレス: 60kg×10回, 65kg×8回 ｜ 計2セット/負荷量1120kg`
//   2. 旧アプリ    `[胸]ベンチプレス: 1.60kg×10, 2.65kg×8`   ← 先頭の "1." はセット番号
//   3. 括弧つき    `ベンチプレス(20kgx10, 50kgx4), ラットプルダウン(30kgx20, 35kgx20)`
//   4. 入れ子      `脚トレ全完遂［スクワット(20kgx10, 60kgx7), レッグカール(35kgx12)］`
//
// 2 は「重量の小数点」と「セット番号」が区別できないため、現行アプリでは必ず
// `回` を付けて書く（formatWorkoutForSheet 参照）。ここでは `回` 付きを優先して
// 読み、見つからなければ旧形式として連番プレフィックスを剥がす。

import { guessMuscle } from './exercises';

export interface ParsedSet      { weight: number; reps: number }
export interface ParsedExercise { muscle: string; name: string; sets: ParsedSet[]; volume: number }
export interface ParsedWorkout  { exercises: ParsedExercise[]; totalVolume: number; setCount: number }

const STRICT = /(\d+(?:\.\d+)?)\s*kg\s*[×xX*]\s*(\d+)\s*回/g;
const LOOSE  = /(\d+(?:\.\d+)?)\s*kg\s*[×xX*]\s*(\d+)/;
const OPEN   = '（(［【';
const CLOSE  = '）)］】';

function parseSets(setsPart: string): ParsedSet[] {
  const strict = Array.from(setsPart.matchAll(STRICT));
  if (strict.length > 0) {
    return strict.map(m => ({ weight: parseFloat(m[1]), reps: parseInt(m[2], 10) }));
  }

  // 旧形式・手書き形式。トークン先頭にセット番号(1. 2. 3. …)が付くことがある。
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

function toExercise(name: string, sets: ParsedSet[], muscle?: string): ParsedExercise | null {
  const clean = name.replace(/^[\s,、/・]+|[\s,、/・]+$/g, '');
  // 種目名らしくないもの（数字始まり＝セット表記の切れ端、1文字）は捨てる
  if (clean.length < 2 || /^\d/.test(clean) || sets.length === 0) return null;
  return {
    muscle: muscle ?? guessMuscle(clean),
    name:   clean,
    sets,
    volume: sets.reduce((s, x) => s + x.weight * x.reps, 0),
  };
}

/** `種目名(セット, セット), 種目名(…)` 形式。括弧は入れ子を数えて対応を取る。 */
function parseBracketFormat(text: string): ParsedExercise[] {
  const out: ParsedExercise[] = [];
  let i = 0, nameStart = 0;

  while (i < text.length) {
    const ch = text[i];

    if (OPEN.includes(ch)) {
      const name = text.slice(nameStart, i);
      let depth = 1, j = i + 1;
      while (j < text.length && depth > 0) {
        if (OPEN.includes(text[j])) depth++;
        else if (CLOSE.includes(text[j])) depth--;
        j++;
      }
      const content = text.slice(i + 1, j - (depth === 0 ? 1 : 0));

      // 入れ子（`まとめ名［種目(…), 種目(…)］`）なら中身を優先する
      const nested = content.split('').some(c => OPEN.includes(c)) ? parseBracketFormat(content) : [];
      if (nested.length > 0) {
        out.push(...nested);
      } else {
        const ex = toExercise(name, parseSets(content));
        if (ex) out.push(ex);
      }

      i = j;
      nameStart = j;
      continue;
    }

    if (ch === ',' || ch === '、' || ch === '/') nameStart = i + 1;
    i++;
  }
  return out;
}

/** `[胸]種目名: セット, セット / [腕]種目名: …` 形式（アプリが書く書式） */
function parseAppFormat(text: string): ParsedExercise[] {
  const out: ParsedExercise[] = [];

  for (const chunk of text.split(/\s*\/\s*/).map(c => c.trim()).filter(Boolean)) {
    const tag    = chunk.match(/^\[([^\]]{1,6})\]\s*/);
    const body   = tag ? chunk.slice(tag[0].length) : chunk;
    const sepIdx = body.search(/[:：]/);
    if (sepIdx < 0) continue;

    const ex = toExercise(body.slice(0, sepIdx), parseSets(body.slice(sepIdx + 1)), tag?.[1]);
    if (ex) out.push(ex);
  }
  return out;
}

export function parseSheetWorkout(raw: unknown): ParsedWorkout | null {
  const text = String(raw ?? '').split('｜')[0].trim();
  if (!text) return null;

  let exercises = /^\s*\[[^\]]{1,6}\]/.test(text) ? parseAppFormat(text) : parseBracketFormat(text);

  // 括弧がまったく無い自由記述（`ベンチプレス 60kg×10回` など）への保険
  if (exercises.length === 0) {
    const sepIdx = text.search(/[:：]/);
    const name   = sepIdx >= 0 ? text.slice(0, sepIdx) : text.replace(/\d.*$/, '');
    const ex     = toExercise(name, parseSets(sepIdx >= 0 ? text.slice(sepIdx + 1) : text));
    exercises = ex ? [ex] : [];
  }

  if (exercises.length === 0) return null;
  return {
    exercises,
    totalVolume: exercises.reduce((s, e) => s + e.volume, 0),
    setCount:    exercises.reduce((s, e) => s + e.sets.length, 0),
  };
}
