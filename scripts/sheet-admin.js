#!/usr/bin/env node
// Minimal spreadsheet admin client for the existing GAS endpoint.
// Usage:
//   npm run sheet:list
//   npm run sheet:setup-governance
//   npm run sheet:read -- "シート名" "A1:K5"
//   npm run sheet:write -- "シート名" "A1" "text"
//   npm run sheet:write-file -- "シート名" "A1" "path/to/file.md"
//   npm run sheet:clear -- "シート名" "A1"
//   npm run sheet:write-json -- "シート名" "A1:B2" "[[1,2],[3,4]]"
//   npm run sheet:log-change -- "{\"actor\":\"Codex\",\"summary\":\"...\"}"
//   npm run sheet:log-meeting -- "{\"actor\":\"Codex\",\"summary\":\"...\"}"
//   npm run sheet:log-change-simple -- "Codex" "tool" "target" "type" "summary" "reason" "yes" "related"
//   npm run sheet:log-meeting-simple -- "Codex" "source" "summary" "decisions" "actions" "affected"

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');

function endpointFromEnvFile() {
  if (!fs.existsSync(envPath)) return '';
  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('GAS_ENDPOINT='));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const endpoint = (process.env.GAS_ENDPOINT || endpointFromEnvFile()).trim();
if (!endpoint) {
  console.error('Error: GAS_ENDPOINT is not set.');
  process.exit(1);
}

function valueFromEnvFile(name) {
  if (!fs.existsSync(envPath)) return '';
  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(name + '='));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const adminToken = (process.env.SHEET_ADMIN_TOKEN || valueFromEnvFile('SHEET_ADMIN_TOKEN')).trim();

const [,, command, sheet, range, raw] = process.argv;

async function post(payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json.error) throw new Error(json.error);
    return json;
  } catch (e) {
    if (e.message !== text) throw e;
    throw new Error('Failed to parse GAS response: ' + text.slice(0, 160));
  }
}

function printTable(values) {
  for (const row of values) {
    console.log(row.map((v) => String(v ?? '')).join('\t'));
  }
}

(async () => {
  if (command === 'list') {
    const json = await post({ action: 'listSheets' });
    for (const s of json.sheets || []) {
      console.log(`${s.name}\t${s.rows} rows`);
    }
    return;
  }

  if (command === 'setup-governance') {
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const json = await post({ action: 'setupAiGovernance', adminToken, actor: 'Codex', tool: 'sheet-admin' });
    console.log(`Configured AI governance tabs: ${(json.sheets || []).join(', ')}`);
    return;
  }

  if (command === 'read') {
    if (!sheet || !range) throw new Error('Usage: read <sheet> <range>');
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const json = await post({ action: 'getRange', sheet, range, adminToken });
    console.log(`# ${json.sheet}!${json.range}`);
    printTable(json.displayValues || json.values || []);
    return;
  }

  if (command === 'write') {
    if (!sheet || !range) throw new Error('Usage: write <sheet> <range> <value>');
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const json = await post({ action: 'updateRange', sheet, range, value: raw || '', adminToken });
    console.log(`Updated ${json.sheet}!${json.range} (${json.rows}x${json.columns})`);
    return;
  }

  if (command === 'write-file') {
    if (!sheet || !range || !raw) throw new Error('Usage: write-file <sheet> <range> <file>');
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const filePath = path.resolve(process.cwd(), raw);
    const value = fs.readFileSync(filePath, 'utf8');
    const json = await post({ action: 'updateRange', sheet, range, value, adminToken });
    console.log(`Updated ${json.sheet}!${json.range} from ${filePath} (${value.length} chars)`);
    return;
  }

  if (command === 'clear') {
    if (!sheet || !range) throw new Error('Usage: clear <sheet> <range>');
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const json = await post({ action: 'updateRange', sheet, range, value: '', adminToken });
    console.log(`Cleared ${json.sheet}!${json.range}`);
    return;
  }

  if (command === 'write-json') {
    if (!sheet || !range || !raw) throw new Error('Usage: write-json <sheet> <range> <json-values>');
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const values = JSON.parse(process.env.SHEET_VALUES_JSON || raw);
    const json = await post({ action: 'updateRange', sheet, range, values, adminToken });
    console.log(`Updated ${json.sheet}!${json.range} (${json.rows}x${json.columns})`);
    return;
  }

  if (command === 'log-change') {
    if (!sheet) throw new Error('Usage: log-change <json-payload>');
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const payload = JSON.parse(sheet);
    const json = await post({ action: 'appendAiChangeLog', ...payload, adminToken });
    console.log(`Logged change to ${json.sheet} row ${json.row}`);
    return;
  }

  if (command === 'log-change-simple') {
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const [actor, tool, target, changeType, summary, reason, userConfirmed, related] = process.argv.slice(3);
    const json = await post({
      action: 'appendAiChangeLog',
      actor,
      tool,
      target,
      changeType,
      summary,
      reason,
      userConfirmed,
      related,
      adminToken,
    });
    console.log(`Logged change to ${json.sheet} row ${json.row}`);
    return;
  }

  if (command === 'log-meeting') {
    if (!sheet) throw new Error('Usage: log-meeting <json-payload>');
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const payload = JSON.parse(sheet);
    const json = await post({ action: 'appendAiMeetingNote', ...payload, adminToken });
    console.log(`Logged meeting note to ${json.sheet} row ${json.row}`);
    return;
  }

  if (command === 'log-meeting-simple') {
    if (!adminToken) throw new Error('SHEET_ADMIN_TOKEN is not set.');
    const [actor, conversationSource, summary, decisions, actionItems, affectedDocsOrTabs] = process.argv.slice(3);
    const json = await post({
      action: 'appendAiMeetingNote',
      actor,
      conversationSource,
      summary,
      decisions,
      actionItems,
      affectedDocsOrTabs,
      adminToken,
    });
    console.log(`Logged meeting note to ${json.sheet} row ${json.row}`);
    return;
  }

  console.error('Usage: sheet-admin.js <list|setup-governance|read|write|write-file|clear|write-json|log-change|log-meeting|log-change-simple|log-meeting-simple> ...');
  process.exit(1);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
