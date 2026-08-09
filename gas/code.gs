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
    }))
    .filter(l => l.date && /^\d{4}-\d{2}-\d{2}$/.test(l.date) && (l.weight > 0 || l.calories > 0))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);

  // ── M-R: AI計画 ───────────────────────────────────────────────────────────
  // 各行: M=日付, N=部位, O=種目, P=目標重量, Q=セット詳細, R=レスト秒
  let aiPlan = null;
  try {
    const aiRows = dataRows.filter(row => row[C.AI_NAME] && String(row[C.AI_NAME]).trim());
    if (aiRows.length > 0) {
      aiRows.sort((a, b) => toDateStr(b[C.AI_DATE]).localeCompare(toDateStr(a[C.AI_DATE])));
      const latestDate = toDateStr(aiRows[0][C.AI_DATE]) || toDateStr(new Date());
      const dayRows    = aiRows.filter(row => toDateStr(row[C.AI_DATE]) === latestDate);

      const exercises = dayRows.map(row => {
        const setsDetail = String(row[C.AI_SETS] || '');
        // セット数: カンマ区切りのアイテム数、または "Xセット" のパース
        const setCount = setsDetail.split(',').filter(s => s.trim()).length || 1;
        return {
          muscle:       String(row[C.AI_MUS]  || ''),
          name:         String(row[C.AI_NAME] || ''),
          targetWeight: parseFloat(row[C.AI_WT])   || 0,
          targetReps:   0,
          sets:         setCount,
          restSeconds:  parseInt(row[C.AI_REST])    || 60,
          setsDetail,   // "20kg×10, 40kg×8, 80kg×2" 形式の生テキスト
        };
      }).filter(e => e.name);

      if (exercises.length > 0) {
        aiPlan = {
          date: latestDate,
          exercises,
          rawText: exercises.map(e =>
            `[${e.muscle}] ${e.name}  ${e.setsDetail || e.targetWeight + 'kg'}  休憩${e.restSeconds}秒`
          ).join('\n'),
        };
      }
    }
  } catch (_) {}

  return { logs, aiPlan };
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
      ex[C.MEMO]     || '',                         // K メモ (保持)
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
      '',                                           // K メモ
    ];
    sheet.appendRow(rowData);
    return { success: true, action: 'appended' };
  }
}
