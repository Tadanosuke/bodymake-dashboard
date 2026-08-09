// Google Apps Script — ボディメイクダッシュボード連携 v4
// 1. このファイルの内容をApps Scriptエディタに貼り付け（全置換）
// 2. 「デプロイ」→「デプロイを管理」→既存のデプロイを「編集」→「バージョン: 新しいバージョン」で更新

const SPREADSHEET_ID = '1wJefKcr0S2hPcI9s7e1c89kWabnYpgQa0eg315pxtlE';
const LOG_SHEET_NAME = 'Sheet1';

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

function getOrCreateLogSheet(ss) {
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(['日付', '体重(kg)', 'カロリー(kcal)', 'P(g)', 'F(g)', 'C(g)', '歩数', '筋トレメニュー', '睡眠', '筋肉痛(DOMS)', '明日の予定']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ========== アクション ==========

function listSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return { sheets: ss.getSheets().map(s => ({ name: s.getName(), rows: s.getLastRow() })) };
}

// CLAUDE_MD_MASTERタブのA1セルを返す
function getClaude() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CLAUDE_MD_MASTER');
  if (!sheet) return { error: 'CLAUDE_MD_MASTER sheet not found' };
  const content = sheet.getRange('A1').getValue();
  return { content: String(content || '') };
}

function getDashboard() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Sheet1を優先、なければ最もデータの多いシート
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    const sheets = ss.getSheets();
    logSheet = sheets.reduce((best, s) => s.getLastRow() > (best ? best.getLastRow() : 0) ? s : best, null);
  }

  const rows = logSheet ? logSheet.getDataRange().getValues() : [];
  const dataRows = rows.length > 1 ? rows.slice(1) : rows;

  // A-K列: 日次ログデータ
  const logs = dataRows
    .map(row => ({
      date:     toDateStr(row[0]),
      weight:   parseFloat(row[1]) || 0,
      calories: parseInt(row[2])   || 0,
      protein:  parseFloat(row[3]) || 0,
      fat:      parseFloat(row[4]) || 0,
      carbs:    parseFloat(row[5]) || 0,
      steps:    parseInt(row[6])   || 0,
      workout:  String(row[7] || ''),
    }))
    .filter(l => l.date && l.date.match(/^\d{4}-\d{2}-\d{2}$/) && (l.weight > 0 || l.calories > 0))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);

  // M-R列 (index 12-17): AI計画データ
  // 部位(M), 種目(N), 目標重量(O), 目標回数(P), セット数(Q), レスト秒(R)
  let aiPlan = null;
  try {
    const aiRows = dataRows.filter(row => row[13] && String(row[13]).trim());
    if (aiRows.length > 0) {
      // 最新のAI計画行を取得（日付順でソート）
      aiRows.sort((a, b) => toDateStr(b[0]).localeCompare(toDateStr(a[0])));
      const latestDate = toDateStr(aiRows[0][0]) || toDateStr(new Date());
      const sameDateRows = aiRows.filter(row => toDateStr(row[0]) === latestDate);

      const exercises = sameDateRows.map(row => ({
        muscle:       String(row[12] || ''),
        name:         String(row[13] || ''),
        targetWeight: parseFloat(row[14]) || 0,
        targetReps:   parseInt(row[15])   || 0,
        sets:         parseInt(row[16])   || 0,
        restSeconds:  parseInt(row[17])   || 60,
      })).filter(e => e.name);

      if (exercises.length > 0) {
        aiPlan = {
          date: latestDate,
          exercises,
          rawText: exercises.map(e =>
            `[${e.muscle}] ${e.name} ${e.targetWeight}kg × ${e.targetReps}回 × ${e.sets}セット (休憩${e.restSeconds}秒)`
          ).join('\n'),
        };
      }
    }
  } catch (_) {}

  // AI計画が M-R になければ旧来の専用シートから読む (後方互換)
  if (!aiPlan) {
    try {
      const aiSheet = ss.getSheetByName('AI計画') || ss.getSheetByName('AI次回計画');
      if (aiSheet) {
        const aiData = aiSheet.getDataRange().getValues();
        if (aiData.length > 1) {
          aiPlan = {
            date: toDateStr(aiData[1][0]) || toDateStr(new Date()),
            rawText: String(aiData[1][1] || ''),
          };
        }
      }
    } catch (_) {}
  }

  return { logs, aiPlan };
}

function appendLog(payload) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateLogSheet(ss);

  const dateStr = String(payload.date || toDateStr(new Date())).slice(0, 10);
  const rows    = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (toDateStr(rows[i][0]) === dateStr) { targetRow = i + 1; break; }
  }

  if (targetRow > 0) {
    // 既存行の更新: アプリが送信した列のみ上書き。Geminiが書いたカロリー列(C-F)は保持。
    const existing = rows[targetRow - 1];
    const rowData = [
      dateStr,
      parseFloat(payload.weight) || existing[1] || '',   // 体重: アプリ優先
      existing[2] || '',                                  // カロリー: Gemini値を保持
      existing[3] || '',                                  // P: 保持
      existing[4] || '',                                  // F: 保持
      existing[5] || '',                                  // C: 保持
      parseInt(payload.steps)   || existing[6] || '',    // 歩数
      payload.workout           || existing[7] || '',    // 筋トレ
      payload.sleep             || existing[8] || '',    // 睡眠
      payload.doms              || existing[9] || '',    // DOMS
      payload.tomorrow          || existing[10] || '',   // 明日の予定
    ];
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return { success: true, action: 'updated', row: targetRow };
  } else {
    const rowData = [
      dateStr,
      parseFloat(payload.weight) || '',
      '',  // カロリー (Gemini記入)
      '',  // P
      '',  // F
      '',  // C
      parseInt(payload.steps)   || '',
      payload.workout           || '',
      payload.sleep             || '',
      payload.doms              || '',
      payload.tomorrow          || '',
    ];
    sheet.appendRow(rowData);
    return { success: true, action: 'appended' };
  }
}
