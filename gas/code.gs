// Google Apps Script — ボディメイクダッシュボード連携 v2
// 1. このファイルの内容をApps Scriptエディタに貼り付け（全置換）
// 2. 「デプロイ」→「デプロイを管理」→既存のデプロイを「編集」→「バージョン: 新しいバージョン」で更新
// 3. URLは変わらないのでVercel環境変数の変更は不要

const SPREADSHEET_ID = '1wJefKcr0S2hPcI9s7e1c89kWabnYpgQa0eg315pxtlE';
const LOG_SHEET_NAME = 'ログ';

// ========== ルーティング ==========

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getDashboard';
  try {
    if (action === 'getDashboard') return respond(getDashboard());
    if (action === 'listSheets')  return respond(listSheets());
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

/** Google Sheetsのセル値を YYYY-MM-DD 文字列に変換 */
function toDateStr(val) {
  if (!val) return '';
  try {
    // GASはDateオブジェクト or 数値(シリアル) or 文字列を返す
    const d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val).split('T')[0];
    return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
  } catch (_) {
    return String(val).slice(0, 10);
  }
}

/** 'ログ'シートを取得（なければ作成） */
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

function getDashboard() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 'ログ'シートを使う。なければ最初の行数が多いシート
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    const sheets = ss.getSheets();
    logSheet = sheets.reduce((best, s) => s.getLastRow() > (best ? best.getLastRow() : 0) ? s : best, null);
  }

  const rows = logSheet ? logSheet.getDataRange().getValues() : [];

  // ヘッダー行スキップ（1行目が日付以外 or 文字列だったらスキップ）
  const dataRows = rows.length > 1 ? rows.slice(1) : rows;

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
    .filter(l => l.date && l.date.match(/^\d{4}-\d{2}-\d{2}$/) && l.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const currentWeight = logs.length > 0 ? logs[0].weight : 90.0;
  const today         = logs.length > 0 ? logs[0] : {};

  // グラフ用: 古い順に並べ、今後の予測ポイントも追加
  const historyData = logs.slice().reverse();
  const weightHistory = historyData.map(l => ({
    date:   l.date.slice(5).replace('-', '/'),  // MM/DD
    weight: l.weight,
    ideal:  Math.max(92.5 - ((new Date(l.date) - new Date('2026-07-01')) / 86400000) * (17.5 / 214), 75),
  }));

  // 直近体重から予測ラインを3ヶ月分追加
  if (logs.length > 0) {
    const lastDate   = new Date(logs[0].date);
    const lossPerDay = 0.55 / 7;
    for (let i = 7; i <= 90; i += 7) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      const dateStr = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
      weightHistory.push({
        date:      dateStr.slice(5).replace('-', '/'),
        predicted: Math.max(currentWeight - lossPerDay * i, 75),
        ideal:     Math.max(92.5 - ((d - new Date('2026-07-01')) / 86400000) * (17.5 / 214), 75),
      });
    }
  }

  const now = new Date();
  const daysTo = (targetStr) => Math.ceil((new Date(targetStr) - now) / 86400000);

  return {
    currentWeight,
    phaseTarget:      87.0,
    finalTarget:      75.0,
    startWeight:      92.5,
    startDate:        '2026-07-01',
    phaseTargetDate:  '2026-09-15',
    finalTargetDate:  '2027-01-31',
    daysToPhaseTarget: daysTo('2026-09-15'),
    daysToFinalTarget: daysTo('2027-01-31'),
    weeklyLossRate:   0.55,
    weightHistory,
    milestones: [
      { weight: 87, label: 'Phase 1',  idealDate: '2026-09-15', achieved: currentWeight <= 87 },
      { weight: 85, label: 'Phase 2',  idealDate: '2026-10-10', achieved: currentWeight <= 85 },
      { weight: 82, label: 'Phase 3',  idealDate: '2026-11-05', achieved: currentWeight <= 82 },
      { weight: 80, label: 'Phase 4',  idealDate: '2026-11-25', achieved: currentWeight <= 80 },
      { weight: 77, label: 'Phase 5',  idealDate: '2026-12-20', achieved: currentWeight <= 77 },
      { weight: 75, label: '最終目標', idealDate: '2027-01-31', achieved: currentWeight <= 75 },
    ],
    today: {
      calories: { actual: today.calories || 0, target: 1800 },
      protein:  { actual: today.protein  || 0, target: 150 },
      fat:      { actual: today.fat      || 0, target: 55 },
      carbs:    { actual: today.carbs    || 0, target: 180 },
      steps:    { actual: today.steps    || 0, target: 8000 },
    },
    logs,
  };
}

function appendLog(payload) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateLogSheet(ss);

  // 同じ日付が既に存在する場合は上書き
  const dateStr = String(payload.date || toDateStr(new Date())).slice(0, 10);
  const rows    = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (toDateStr(rows[i][0]) === dateStr) { targetRow = i + 1; break; }
  }

  const rowData = [
    dateStr,
    parseFloat(payload.weight)  || '',
    parseInt(payload.calories)  || '',  // Gemini が記帳 (アプリからは空)
    parseFloat(payload.protein) || '',  // 同上
    parseFloat(payload.fat)     || '',  // 同上
    parseFloat(payload.carbs)   || '',  // 同上
    parseInt(payload.steps)     || '',
    payload.workout             || '',
    payload.sleep               || '',  // 睡眠時間 (例: 7.5時間 (23:30-07:00))
    payload.doms                || '',  // 筋肉痛部位
    payload.tomorrow            || '',  // 明日の予定タグ
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return { success: true, action: 'updated', row: targetRow };
  } else {
    sheet.appendRow(rowData);
    return { success: true, action: 'appended' };
  }
}
