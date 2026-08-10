#!/usr/bin/env node
// Minimal spreadsheet admin client for the existing GAS endpoint.
// Usage:
//   npm run sheet:list
//   npm run sheet:read -- "シート名" "A1:K5"
//   npm run sheet:write -- "シート名" "A1" "text"
//   npm run sheet:clear -- "シート名" "A1"
//   npm run sheet:write-json -- "シート名" "A1:B2" "[[1,2],[3,4]]"

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
    const values = JSON.parse(raw);
    const json = await post({ action: 'updateRange', sheet, range, values, adminToken });
    console.log(`Updated ${json.sheet}!${json.range} (${json.rows}x${json.columns})`);
    return;
  }

  console.error('Usage: sheet-admin.js <list|read|write|clear|write-json> ...');
  process.exit(1);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
