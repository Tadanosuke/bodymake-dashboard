// Google Apps Script — ボディメイクダッシュボード連携 v5
// 1. このファイルの内容をApps Scriptエディタに貼り付け（全置換）
// 2. 「デプロイ」→「デプロイを管理」→既存のデプロイを「編集」→「バージョン: 新しいバージョン」で更新

const SPREADSHEET_ID = '1wJefKcr0S2hPcI9s7e1c89kWabnYpgQa0eg315pxtlE';
const LOG_SHEET_NAME = 'ボディメイク＆減量プロジェクト_総合管理シート';

// ── Sheet1 列インデックス (0-based) ──────────────────────────────────────────
// A(0)=日付  B(1)=体重  C(2)=摂取cal  D(3)=P  E(4)=F  F(5)=C
// G(6)=消費cal  H(7)=歩数  I(8)=筋トレ部位・メニュー  J(9)=その他運動  K(10)=メモ・コンディション
// L(11)=空欄
// M(12)=AI日付  N(13)=ターゲット部位  O(14)=提案種目  P(15)=目標重量  Q(16)=セット詳細  R(17)=レスト時間

const C = {
  DATE:     0,  // A
  WEIGHT:   1,  // B
  CAL_IN:   2,  // C 摂取カロリー
  PROTEIN:  3,  // D
  FAT:      4,  // E
  CARBS:    5,  // F
  CAL_BURN: 6,  // G 消費カロリー
  STEPS:    7,  // H
  WORKOUT:  8,  // I
  CARDIO:   9,  // J その他運動
  MEMO:    10,  // K メモ・コンディション
  AI_DATE:  12, // M
  AI_MUS:   13, // N ターゲット部位
  AI_NAME:  14, // O 提案種目
  AI_WT:    15, // P 目標重量
  AI_SETS:  16, // Q セット詳細
  AI_REST:  17, // R レスト時間
};

// ========== ルーティング ==========

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getDashboard';
  try {
    if (action === 'getDashboard') return respond(getDashboard());
    if (action === 'listSheets')  return respond(listSheets());
    if (action === 'getClaude')   return respond(getClaude());
    if (action === 'dumpSheet')   return respond(dumpSheet(e.parameter.name));
    return respond({ error: 'Unknown action: ' + action });
  } catch (err) {
    return respond({ error: String(err), stack: err.stack });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || 'appendLog';
    if (action === 'appendLog') return respond(appendLog(payload));
    return respond({ error: 'Unknown action: ' + action });
  } catch (err) {
    return respond({ error: String(err) });
  }
}

// ========== ユーティリティ ==========

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function toDateStr(val) {
  if (!val) return '';
  try {
    const d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val).split('T')[0];
    return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
  } catch (_) {
    return String(val).slice(0, 10);
  }
}

function getSheet(ss) {
  const sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) throw new Error('Sheet1 が見つかりません');
  return sheet;
}

// ========== アクション ==========

function listSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return { sheets: ss.getSheets().map(s => ({ name: s.getName(), rows: s.getLastRow() })) };
}

// CLAUDE_MD_MASTERタブのA1セル内容を返す
function getClaude() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CLAUDE_MD_MASTER');
  if (!sheet) return { error: 'CLAUDE_MD_MASTER sheet not found' };
  return { content: String(sheet.getRange('A1').getValue() || '') };
}

// ── AI計画パース ─────────────────────────────────────────────────────────────
// 『進捗＆予測ダッシュボード』のセルを全走査し「AI次回計画メニュー (YYYY/MM/DD 部位 場所)」
// という見出しを見つけ、その直下の連続行を種目として読む。
// 種目行の形式: 「種目名: 7.5kg*2*10(アップ), 24kg*2*8(メイン1) | レスト2.5分」
function parseRest(text) {
  const m = String(text).match(/レスト\s*([\d.]+)\s*(分|秒)/);
  if (!m) return 90;
  const n = parseFloat(m[1]);
  return m[2] === '分' ? Math.round(n * 60) : Math.round(n);
}

function parseSetsDetail(text) {
  // "7.5kg*2*10(アップ)" → { weight: 7.5, count: 2, reps: 10, label: 'アップ' }
  const out = [];
  String(text).split(',').forEach(function (chunk) {
    const m = chunk.match(/([\d.]+)\s*kg\s*\*\s*(\d+)\s*\*\s*(\d+)\s*(?:\(([^)]*)\))?/);
    if (m) {
      out.push({
        weight: parseFloat(m[1]),
        count:  parseInt(m[2]),
        reps:   parseInt(m[3]),
        label:  (m[4] || '').trim(),
      });
    }
  });
  return out;
}

function findAiPlan(ss) {
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const rows = sheets[s].getDataRange().getValues();
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < rows[i].length; j++) {
        const cell = String(rows[i][j] || '');
        const head = cell.match(/AI次回計画メニュー\s*[（(]\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*([^)）]*)[)）]/);
        if (!head) continue;

        const date = head[1] + '-' + ('0' + head[2]).slice(-2) + '-' + ('0' + head[3]).slice(-2);
        const meta = (head[4] || '').trim().split(/\s+/);   // ["Push", "自宅"]
        const split = meta[0] || '';
        const place = meta[1] || '';

        // 見出しの直下、同じ列を下に読む（空セルで終了）
        const exercises = [];
        for (let r = i + 1; r < rows.length; r++) {
          const line = String(rows[r][j] || '').trim();
          if (!line) break;
          const ci = line.indexOf(':');
          if (ci < 0) continue;
          const name = line.slice(0, ci).trim();
          const body = line.slice(ci + 1);
          const setsPart = body.split('|')[0];
          const detail   = parseSetsDetail(setsPart);
          const working  = detail.filter(function (d) { return !/アップ/.test(d.label); });
          const heaviest = detail.reduce(function (a, b) { return b.weight > a ? b.weight : a; }, 0);
          exercises.push({
            muscle:       split,
            name:         name,
            sets:         detail.length || 1,
            targetWeight: heaviest,
            targetReps:   working.length ? working[0].reps : (detail.length ? detail[0].reps : 0),
            restSeconds:  parseRest(body),
            setsDetail:   setsPart.trim(),
            setList:      detail,
          });
        }

        if (exercises.length) {
          return {
            date: date,
            split: split,
            place: place,
            exercises: exercises,
            rawText: exercises.map(function (e) {
              return e.name + ': ' + e.setsDetail + ' | レスト' + e.restSeconds + '秒';
            }).join('\n'),
          };
        }
      }
    }
  }
  return null;
}

function getDashboard() {
  const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getSheet(ss);

  const rows     = logSheet.getDataRange().getValues();
  const dataRows = rows.length > 1 ? rows.slice(1) : [];

  // ── A-K: 日次ログ ─────────────────────────────────────────────────────────
  const logs = dataRows
    .map(row => ({
      date:     toDateStr(row[C.DATE]),
      weight:   parseFloat(row[C.WEIGHT])  || 0,
      calories: parseInt(row[C.CAL_IN])    || 0,
      protein:  parseFloat(row[C.PROTEIN]) || 0,
      fat:      parseFloat(row[C.FAT])     || 0,
      carbs:    parseFloat(row[C.CARBS])   || 0,
      steps:    parseInt(row[C.STEPS])     || 0,
      workout:  String(row[C.WORKOUT] || ''),
      calBurn:  parseInt(row[C.CAL_BURN])  || 0,
      cardio:   String(row[C.CARDIO] || ''),
      memo:     String(row[C.MEMO] || ''),
    }))
    .filter(l => l.date && /^\d{4}-\d{2}-\d{2}$/.test(l.date) && (l.weight > 0 || l.calories > 0))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);

  // ── AI計画 (全シート走査で見出しを探す) ───────────────────────────────────
  let aiPlan = null;
  try {
    aiPlan = findAiPlan(ss);
  } catch (_) {}

  return { logs, aiPlan };
}

// K列(メモ・コンディション)に睡眠/筋肉痛/明日の予定を構造化して埋め込む。
// Gemini が自由記述した部分は温存し、アプリ管轄のセグメントのみ差し替える。
const APP_KEYS = ['睡眠', '筋肉痛', '明日'];

function buildMemo(existingMemo, payload) {
  const kept = String(existingMemo || '')
    .split(' / ')
    .map(function (s) { return s.trim(); })
    .filter(function (s) {
      if (!s) return false;
      for (let i = 0; i < APP_KEYS.length; i++) {
        if (s.indexOf(APP_KEYS[i] + ':') === 0) return false;  // アプリ管轄は捨てる
      }
      return true;  // Gemini の自由記述は残す
    });

  const segs = [];
  if (payload.sleep)    segs.push('睡眠: '   + payload.sleep);
  if (payload.doms)     segs.push('筋肉痛: ' + payload.doms);
  if (payload.tomorrow) segs.push('明日: '   + payload.tomorrow);

  return segs.concat(kept).join(' / ');
}

function appendLog(payload) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheet(ss);

  const dateStr = String(payload.date || toDateStr(new Date())).slice(0, 10);
  const rows    = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (toDateStr(rows[i][C.DATE]) === dateStr) { targetRow = i + 1; break; }
  }

  if (targetRow > 0) {
    // 既存行更新: アプリ管轄列(B, H, I)のみ上書き。Gemini管轄(C-G, J, K)は保持。
    const ex = rows[targetRow - 1];
    const rowData = [
      dateStr,                                       // A 日付
      parseFloat(payload.weight) || ex[C.WEIGHT] || '', // B 体重
      ex[C.CAL_IN]   || '',                         // C 摂取cal (Gemini)
      ex[C.PROTEIN]  || '',                         // D P (Gemini)
      ex[C.FAT]      || '',                         // E F (Gemini)
      ex[C.CARBS]    || '',                         // F C (Gemini)
      ex[C.CAL_BURN] || '',                         // G 消費cal (Gemini)
      parseInt(payload.steps) || ex[C.STEPS] || '', // H 歩数
      payload.workout || ex[C.WORKOUT] || '',        // I 筋トレ
      ex[C.CARDIO]   || '',                         // J その他運動 (保持)
      buildMemo(ex[C.MEMO], payload),               // K 睡眠/筋肉痛/明日 + Gemini記述
    ];
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return { success: true, action: 'updated', row: targetRow };
  } else {
    const rowData = [
      dateStr,
      parseFloat(payload.weight) || '',
      '', '', '', '', '',                            // C-G: Gemini記入欄
      parseInt(payload.steps)  || '',               // H 歩数
      payload.workout          || '',               // I 筋トレ
      '',                                           // J その他
      buildMemo('', payload),                       // K 睡眠/筋肉痛/明日
    ];
    sheet.appendRow(rowData);
    return { success: true, action: 'appended' };
  }
}
