// Google Apps Script — ボディメイクダッシュボード連携
// 1. このファイルをApps Scriptにコピー
// 2. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」で公開 (全員アクセス可)
// 3. 発行されたURLをVercelの環境変数 GAS_ENDPOINT に設定

const SPREADSHEET_ID = '1wJefKcr0S2hPcI9s7e1c89kWabnYpgQa0eg315pxtlE';
const LOG_SHEET_NAME = 'ログ';

function doGet(e) {
  const action = e.parameter.action || 'getDashboard';

  if (action === 'getDashboard') {
    return getDashboard();
  }

  return respond({ error: 'Unknown action' });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const action = payload.action || 'appendLog';

  if (action === 'appendLog') {
    return appendLog(payload);
  }

  return respond({ error: 'Unknown action' });
}

function getDashboard() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);

  if (!logSheet) {
    return respond({ error: 'Log sheet not found' });
  }

  const rows = logSheet.getDataRange().getValues();
  // Skip header row
  const logs = rows.slice(1).reverse().slice(0, 30).map(row => ({
    date:     row[0] ? new Date(row[0]).toISOString().split('T')[0] : '',
    weight:   parseFloat(row[1]) || 0,
    calories: parseInt(row[2]) || 0,
    protein:  parseFloat(row[3]) || 0,
    fat:      parseFloat(row[4]) || 0,
    carbs:    parseFloat(row[5]) || 0,
    steps:    parseInt(row[6]) || 0,
    workout:  row[7] || '',
  })).filter(l => l.date && l.weight > 0);

  const currentWeight = logs[0]?.weight || 90.0;

  // Build weight history for chart
  const weightHistory = logs.slice(0, 20).reverse().map(l => ({
    date: l.date.slice(5).replace('-', '/'),
    weight: l.weight,
    ideal: 92.5 - ((new Date(l.date) - new Date('2026-07-01')) / (1000 * 60 * 60 * 24)) * (17.5 / 214),
  }));

  const today = logs[0] || {};

  const data = {
    currentWeight,
    phaseTarget: 87.0,
    finalTarget: 75.0,
    startWeight: 92.5,
    startDate: '2026-07-01',
    phaseTargetDate: '2026-09-15',
    finalTargetDate: '2027-01-31',
    daysToPhaseTarget: Math.ceil((new Date('2026-09-15') - new Date()) / (1000 * 60 * 60 * 24)),
    daysToFinalTarget: Math.ceil((new Date('2027-01-31') - new Date()) / (1000 * 60 * 60 * 24)),
    weeklyLossRate: 0.55,
    weightHistory,
    milestones: [
      { weight: 87, label: 'Phase 1', idealDate: '2026-09-15', achieved: currentWeight <= 87 },
      { weight: 85, label: 'Phase 2', idealDate: '2026-10-10', achieved: currentWeight <= 85 },
      { weight: 82, label: 'Phase 3', idealDate: '2026-11-05', achieved: currentWeight <= 82 },
      { weight: 80, label: 'Phase 4', idealDate: '2026-11-25', achieved: currentWeight <= 80 },
      { weight: 77, label: 'Phase 5', idealDate: '2026-12-20', achieved: currentWeight <= 77 },
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

  return respond(data);
}

function appendLog(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(['日付', '体重(kg)', 'カロリー(kcal)', 'P(g)', 'F(g)', 'C(g)', '歩数', '運動メモ']);
  }

  sheet.appendRow([
    payload.date,
    payload.weight   || '',
    payload.calories || '',
    payload.protein  || '',
    payload.fat      || '',
    payload.carbs    || '',
    payload.steps    || '',
    payload.workout  || '',
  ]);

  return respond({ success: true });
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
