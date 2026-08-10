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
    if (action === 'makeTemplate') return respond(makeTemplate());
    return respond({ error: 'Unknown action: ' + action });
  } catch (err) {
    return respond({ error: String(err), stack: err.stack });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || 'appendLog';
    if (action === 'listSheets')    return respond(listSheets());
    if (action === 'appendLog')     return respond(appendLog(payload));
    if (action === 'updateAppSpec') return respond(updateAppSpec(payload));
    if (action === 'setupAiGovernance') return respond(setupAiGovernance(payload));
    if (action === 'appendAiChangeLog') return respond(appendAiChangeLog(payload));
    if (action === 'appendAiMeetingNote') return respond(appendAiMeetingNote(payload));
    if (action === 'getRange')      return respond(getRange(payload));
    if (action === 'updateRange')   return respond(updateRange(payload));
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

// このスクリプトが紐づいているスプレッドシートを返す。
// テンプレートをコピーした各ユーザーの環境では、コピーされた本人のシートが対象になる。
function getSS() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(ss) {
  const sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) throw new Error('Sheet1 が見つかりません');
  return sheet;
}

// ========== アクション ==========

function listSheets() {
  const ss = getSS();
  return { sheets: ss.getSheets().map(s => ({ name: s.getName(), rows: s.getLastRow() })) };
}

function requireAdmin_(payload) {
  const expected = String(PropertiesService.getScriptProperties().getProperty('SHEET_ADMIN_TOKEN') || '');
  if (!expected) throw new Error('SHEET_ADMIN_TOKEN is not configured in Apps Script properties');
  const actual = String(payload.adminToken || '');
  if (!actual || actual !== expected) throw new Error('Invalid SHEET_ADMIN_TOKEN');
}

// Run with clasp after deploy/push when enabling Codex/Claude sheet administration:
// npx clasp run setSheetAdminToken --params '["your-token"]'
function setSheetAdminToken(token) {
  const value = String(token || '').trim();
  if (value.length < 24) throw new Error('Token must be at least 24 characters');
  PropertiesService.getScriptProperties().setProperty('SHEET_ADMIN_TOKEN', value);
  return { success: true };
}

function getNamedSheet_(ss, sheetName) {
  const name = String(sheetName || '').trim();
  if (!name) throw new Error('sheet is required');
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

// Codex/Claude 管理用: 任意タブの指定範囲を読む。
// 通常アプリのデータ契約とは別口で、手動確認・運用保守に使う。
function getRange(payload) {
  requireAdmin_(payload);
  const ss = getSS();
  const sheet = getNamedSheet_(ss, payload.sheet);
  const a1 = String(payload.range || '').trim();
  if (!a1) throw new Error('range is required');

  const range = sheet.getRange(a1);
  return {
    success: true,
    sheet: sheet.getName(),
    range: range.getA1Notation(),
    values: range.getValues(),
    displayValues: range.getDisplayValues(),
  };
}

// Codex/Claude 管理用: 任意タブの指定範囲を更新する。
// values は二次元配列。単一セル更新だけなら value も利用可能。
function updateRange(payload) {
  requireAdmin_(payload);
  const ss = getSS();
  const sheet = getNamedSheet_(ss, payload.sheet);
  const a1 = String(payload.range || '').trim();
  if (!a1) throw new Error('range is required');

  let values = payload.values;
  if (!values && Object.prototype.hasOwnProperty.call(payload, 'value')) {
    values = [[payload.value]];
  }
  if (!Array.isArray(values) || !Array.isArray(values[0])) {
    throw new Error('values must be a 2D array, or pass value for a single cell');
  }

  const range = sheet.getRange(a1);
  if (range.getNumRows() !== values.length || range.getNumColumns() !== values[0].length) {
    throw new Error(
      'Range size ' + range.getNumRows() + 'x' + range.getNumColumns()
      + ' does not match values size ' + values.length + 'x' + values[0].length
    );
  }

  range.setValues(values);
  SpreadsheetApp.flush();

  return {
    success: true,
    sheet: sheet.getName(),
    range: range.getA1Notation(),
    rows: values.length,
    columns: values[0].length,
  };
}

const AI_RULES_SHEET_NAME = 'AI運用ルール_必読';
const AI_CHANGE_LOG_SHEET_NAME = 'AI変更履歴';
const AI_MEETING_NOTES_SHEET_NAME = 'AI会話議事録';

const AI_RULES_ROWS = [
  ['AI三者運用ルール（必読）', 'Claude Code / Codex / Gemini Spark must read this tab before changing spreadsheet data, app specs, or implementation assumptions.'],
  ['最終更新', '2026-08-10'],
  ['目的', '3つのAIが同じ正本を参照し、勝手な変更や古い前提による誤実装を防ぐ。'],
  ['必読順序', '1. このタブ  2. AI変更履歴の最新20件  3. AI会話議事録の最新20件  4. アプリ仕様_Claude→Gemini  5. Google Docs 指示書  6. CLAUDE_MD_MASTER / AGENTS.md'],
  ['Google Docs指示書', 'Gemini Spark が毎回参照する最上位指示書: https://docs.google.com/document/d/1K_0vo2KIpjdZDmvC3bhLQREIQekqTSSR-gOBOd17jnY/edit?usp=sharing'],
  ['編集前ルール', 'シートやアプリ仕様を変える前に、対象タブ・列の所有者を確認する。B列体重とI列筋トレ実績はアプリ領域。H列歩数、K列の睡眠/筋肉痛/今日/朝食、C-F栄養はGemini領域。'],
  ['編集後ルール', 'シート、GAS、アプリ、仕様文書を変更したAIは、AI変更履歴へ日時・担当AI・対象・内容・理由・ユーザー確認有無を残す。'],
  ['会話記録ルール', 'ユーザーとの会話で要件、運用、食事/運動方針、データ書式、AI役割が変わった場合、AI会話議事録へ要約・決定事項・次アクションを残す。'],
  ['Docs更新ルール', 'Geminiの日常コーチングや毎回参照する前提が変わる場合は、Google Docs 指示書にも反映する。直接編集できないAIはDocs更新待ちをログに残し、ユーザーに依頼する。'],
  ['正本', '運用ルールはこのタブ。Gemini最上位指示はGoogle Docs指示書。アプリ仕様はアプリ仕様_Claude→Gemini。Claude/Codex作業手順はCLAUDE.md/AGENTS.md。日次データは総合管理シート。'],
  ['競合時', '不明点や矛盾があれば推測で上書きせず、ユーザーに確認する。既存データを消す変更は必ず明示確認を取る。'],
  ['Codex/Claude', '開発・データ解析担当。変更後はdocs/GEMINI_BRIEF.mdを更新し、必要ならsync-geminiでGeminiへ申し送る。'],
  ['Gemini Spark', '日常コーチ・食事解析・朝食後の当日計画担当。AI次回計画メニューは進捗＆予測ダッシュボードに書き、実績I列は触らない。'],
];

const AI_CHANGE_LOG_HEADERS = [
  'timestamp',
  'actor',
  'tool',
  'target',
  'change_type',
  'summary',
  'reason',
  'user_confirmed',
  'related_commit_or_range',
];

const AI_MEETING_NOTES_HEADERS = [
  'timestamp',
  'actor',
  'conversation_source',
  'summary',
  'decisions',
  'action_items',
  'affected_docs_or_tabs',
];

function ensureSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function setupAiGovernance(payload) {
  requireAdmin_(payload);
  const ss = getSS();

  const rules = ensureSheet_(ss, AI_RULES_SHEET_NAME);
  rules.clear();
  rules.getRange(1, 1, AI_RULES_ROWS.length, 2).setValues(AI_RULES_ROWS);
  rules.getRange(1, 1, 1, 2).setFontWeight('bold');
  rules.getRange(1, 1, AI_RULES_ROWS.length, 2).setWrap(true).setVerticalAlignment('top');
  rules.setFrozenRows(1);
  rules.setColumnWidth(1, 180);
  rules.setColumnWidth(2, 900);

  const changes = ensureSheet_(ss, AI_CHANGE_LOG_SHEET_NAME);
  if (changes.getLastRow() === 0) {
    changes.getRange(1, 1, 1, AI_CHANGE_LOG_HEADERS.length).setValues([AI_CHANGE_LOG_HEADERS]).setFontWeight('bold');
    changes.setFrozenRows(1);
  }

  const notes = ensureSheet_(ss, AI_MEETING_NOTES_SHEET_NAME);
  if (notes.getLastRow() === 0) {
    notes.getRange(1, 1, 1, AI_MEETING_NOTES_HEADERS.length).setValues([AI_MEETING_NOTES_HEADERS]).setFontWeight('bold');
    notes.setFrozenRows(1);
  }

  appendAiChangeLog(Object.assign({}, payload, {
    actor: payload.actor || 'Codex',
    tool: payload.tool || 'GAS',
    target: AI_RULES_SHEET_NAME + ' / ' + AI_CHANGE_LOG_SHEET_NAME + ' / ' + AI_MEETING_NOTES_SHEET_NAME,
    changeType: 'governance_setup',
    summary: 'Created/updated mandatory AI coordination tabs and logging protocol.',
    reason: 'Prevent Claude Code, Codex, and Gemini Spark from acting on inconsistent spreadsheet assumptions.',
    userConfirmed: 'yes',
    related: 'setupAiGovernance',
  }));

  return {
    success: true,
    sheets: [AI_RULES_SHEET_NAME, AI_CHANGE_LOG_SHEET_NAME, AI_MEETING_NOTES_SHEET_NAME],
  };
}

function appendAiChangeLog(payload) {
  requireAdmin_(payload);
  const sh = ensureSheet_(getSS(), AI_CHANGE_LOG_SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, AI_CHANGE_LOG_HEADERS.length).setValues([AI_CHANGE_LOG_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const row = [
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
    String(payload.actor || ''),
    String(payload.tool || ''),
    String(payload.target || ''),
    String(payload.changeType || payload.change_type || ''),
    String(payload.summary || ''),
    String(payload.reason || ''),
    String(payload.userConfirmed || payload.user_confirmed || ''),
    String(payload.related || payload.related_commit_or_range || ''),
  ];
  sh.appendRow(row);
  return { success: true, sheet: AI_CHANGE_LOG_SHEET_NAME, row: sh.getLastRow() };
}

function appendAiMeetingNote(payload) {
  requireAdmin_(payload);
  const sh = ensureSheet_(getSS(), AI_MEETING_NOTES_SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, AI_MEETING_NOTES_HEADERS.length).setValues([AI_MEETING_NOTES_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const row = [
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
    String(payload.actor || ''),
    String(payload.conversationSource || payload.conversation_source || ''),
    String(payload.summary || ''),
    String(payload.decisions || ''),
    String(payload.actionItems || payload.action_items || ''),
    String(payload.affectedDocsOrTabs || payload.affected_docs_or_tabs || ''),
  ];
  sh.appendRow(row);
  return { success: true, sheet: AI_MEETING_NOTES_SHEET_NAME, row: sh.getLastRow() };
}

// Claude Code → Gemini Spark への申し送りタブ。
// アプリを変更するたび `npm run sync-gemini` から呼ばれ、全文を書き換える。
const SPEC_SHEET_NAME = 'アプリ仕様_Claude→Gemini';

function updateAppSpec(payload) {
  const ss = getSS();
  let sh = ss.getSheetByName(SPEC_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SPEC_SHEET_NAME);

  const content = String(payload.content || '');
  if (!content.trim()) return { error: 'content が空です' };

  sh.clear();
  sh.getRange('A1').setValue(
    '【自動更新】Claude Code がアプリを変更するたびに全文を書き換えます。ここは手動編集しないでください。');
  sh.getRange('A2').setValue(
    '最終更新: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm')
    + (payload.commit ? '  /  commit ' + payload.commit : ''));
  sh.getRange('A3').setValue(content);

  sh.getRange('A1:A2').setFontWeight('bold');
  sh.getRange('A3').setWrap(true).setVerticalAlignment('top');
  sh.setColumnWidth(1, 900);

  return { success: true, sheet: SPEC_SHEET_NAME, chars: content.length };
}

// CLAUDE_MD_MASTERタブのA1セル内容を返す
function getClaude() {
  const ss = getSS();
  const sheet = ss.getSheetByName('CLAUDE_MD_MASTER');
  if (!sheet) return { error: 'CLAUDE_MD_MASTER sheet not found' };
  return { content: String(sheet.getRange('A1').getValue() || '') };
}

const TEMPLATE_CLAUDE_MD = [
  '# ボディメイク＆減量プロジェクト',
  '',
  '## 目標',
  '（例）半年で -10kg。開始体重 __kg → 目標体重 __kg。',
  '',
  '## AIコーチへの依頼',
  '朝食後、このシートとチャット報告を読んで当日の計画を',
  '『進捗＆予測ダッシュボード』タブに次の形式で書き込んでください。',
  '',
  'AI次回計画メニュー (2026/01/01 胸 ジム)',
  'ベンチプレス: 20kg*1*10(アップ), 40kg*3*8 | レスト90秒',
  '',
  '## メモ欄の書式',
  'K列にはGeminiが「睡眠: / 筋肉痛: / 今日: / 朝食:」を書き込みます。',
  'アプリはK列を上書きしません。',
].join('\n');

const LOG_HEADERS = [
  '日付', '体重(kg)', '摂取カロリー(kcal)', 'タンパク質P(g)', '脂質F(g)', '炭水化物C(g)',
  '消費カロリー(kcal)', '歩数', '筋トレ部位・メニュー', 'その他運動', 'メモ・コンディション',
];

const DASHBOARD_GUIDE = [
  'このタブにはAIコーチ(Gemini等)が朝食後に当日の計画を書き込みます。',
  'アプリは下記の見出しを探して自動で読み取ります。',
  '',
  '書式:',
  'AI次回計画メニュー (YYYY/MM/DD 部位 場所)',
  '種目名: 20kg*1*10(アップ), 40kg*3*8 | レスト90秒',
  '  ※ 重量kg * ダンベルの本数 * 回数 (ラベル)',
  '  ※ 見出しの直後の行から、空行までを1つの計画として読み込みます。',
].join('\n');

// 他ユーザー配布用のテンプレートを新規作成する。
// 既存シートの複製ではなく空から組み立てるので、個人データが混入する余地がない。
// また DriveApp を使わないため追加の権限承認も不要。
// 生成後に返る templateId を NEXT_PUBLIC_TEMPLATE_SPREADSHEET_ID に設定する。
function makeTemplate() {
  const ss = SpreadsheetApp.create('ボディメイク＆減量プロジェクト_テンプレート');

  const main = ss.getSheets()[0];
  main.setName(LOG_SHEET_NAME);
  main.getRange(1, 1, 1, LOG_HEADERS.length)
      .setValues([LOG_HEADERS])
      .setFontWeight('bold');
  main.setFrozenRows(1);

  ss.insertSheet('進捗＆予測ダッシュボード').getRange('A1').setValue(DASHBOARD_GUIDE);
  ss.insertSheet('CLAUDE_MD_MASTER').getRange('A1').setValue(TEMPLATE_CLAUDE_MD);

  SpreadsheetApp.flush();

  return {
    templateId: ss.getId(),
    editUrl:    ss.getUrl(),
    copyUrl:    'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/copy',
    sheets:     ss.getSheets().map(function (s) { return s.getName(); }),
    note:       '共有設定を「リンクを知っている全員 / 閲覧者」にしてください',
  };
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

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseSetsDetail(text) {
  // "7.5kg*2*10(アップ)" or "20kg*10(アップ)"
  // → { weight: 7.5, count: 2, reps: 10, label: 'アップ' }
  const out = [];
  String(text).split(',').forEach(function (chunk) {
    const m = chunk.match(/([\d.]+)\s*kg\s*\*\s*(?:(\d+)\s*\*\s*)?(\d+)\s*(?:\(([^)]*)\))?/);
    if (m) {
      out.push({
        weight: parseFloat(m[1]),
        count:  m[2] ? parseInt(m[2]) : 1,
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
          const main = working.find(function (d) { return /メイン|main/i.test(d.label); }) || working[0] || detail[0];
          exercises.push({
            muscle:       split,
            name:         name,
            sets:         detail.length || 1,
            targetWeight: main ? main.weight : heaviest,
            targetReps:   main ? main.reps : 0,
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
  const ss       = getSS();
  const logSheet = getSheet(ss);

  const rows     = logSheet.getDataRange().getValues();
  const dataRows = rows.length > 1 ? rows.slice(1) : [];

  // ── A-K: 日次ログ ─────────────────────────────────────────────────────────
  const logs = dataRows
    .map(row => ({
      date:     toDateStr(row[C.DATE]),
      weight:   toNumber(row[C.WEIGHT]),
      calories: Math.round(toNumber(row[C.CAL_IN])),
      protein:  toNumber(row[C.PROTEIN]),
      fat:      toNumber(row[C.FAT]),
      carbs:    toNumber(row[C.CARBS]),
      steps:    Math.round(toNumber(row[C.STEPS])),
      workout:  String(row[C.WORKOUT] || ''),
      calBurn:  Math.round(toNumber(row[C.CAL_BURN])),
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

function appendLog(payload) {
  const ss    = getSS();
  const sheet = getSheet(ss);

  const dateStr = String(payload.date || toDateStr(new Date())).slice(0, 10);
  const rows    = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (toDateStr(rows[i][C.DATE]) === dateStr) { targetRow = i + 1; break; }
  }

  if (targetRow > 0) {
    // 既存行更新: アプリ管轄列(B, I)のみ上書き。Gemini管轄(C-H, J, K)は保持。
    const ex = rows[targetRow - 1];
    const rowData = [
      dateStr,                                       // A 日付
      parseFloat(payload.weight) || ex[C.WEIGHT] || '', // B 体重
      ex[C.CAL_IN]   || '',                         // C 摂取cal (Gemini)
      ex[C.PROTEIN]  || '',                         // D P (Gemini)
      ex[C.FAT]      || '',                         // E F (Gemini)
      ex[C.CARBS]    || '',                         // F C (Gemini)
      ex[C.CAL_BURN] || '',                         // G 消費cal (Gemini)
      ex[C.STEPS]    || '',                         // H 歩数 (Gemini)
      payload.workout || ex[C.WORKOUT] || '',        // I 筋トレ
      ex[C.CARDIO]   || '',                         // J その他運動 (保持)
      ex[C.MEMO]     || '',                         // K メモ・コンディション (Gemini)
    ];
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return { success: true, action: 'updated', row: targetRow };
  } else {
    const rowData = [
      dateStr,
      parseFloat(payload.weight) || '',
      '', '', '', '', '',                            // C-G: Gemini記入欄
      '',                                           // H 歩数 (Gemini)
      payload.workout          || '',               // I 筋トレ
      '',                                           // J その他
      '',                                           // K メモ・コンディション (Gemini)
    ];
    sheet.appendRow(rowData);
    return { success: true, action: 'appended' };
  }
}
