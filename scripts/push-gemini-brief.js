#!/usr/bin/env node
// docs/GEMINI_BRIEF.md をスプレッドシートの『アプリ仕様_Claude→Gemini』タブへ転写する。
// Usage: npm run sync-gemini
// 接続先は GAS_ENDPOINT 環境変数、無ければ .env.local から読む。

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root      = path.join(__dirname, '..');
const briefPath = path.join(root, 'docs', 'GEMINI_BRIEF.md');
const envPath   = path.join(root, '.env.local');

function endpointFromEnvFile() {
  if (!fs.existsSync(envPath)) return '';
  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find(l => l.trim().startsWith('GAS_ENDPOINT='));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const endpoint = (process.env.GAS_ENDPOINT || endpointFromEnvFile()).trim();
if (!endpoint) {
  console.error('Error: GAS_ENDPOINT is not set.');
  console.error('Add to .env.local:  GAS_ENDPOINT=https://script.google.com/macros/s/.../exec');
  process.exit(1);
}

if (!fs.existsSync(briefPath)) {
  console.error(`Error: ${briefPath} が見つかりません。`);
  process.exit(1);
}
const content = fs.readFileSync(briefPath, 'utf8');

let commit = '';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch { /* git 管理外でも続行 */ }

(async () => {
  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'updateAppSpec', content, commit }),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch {
      console.error('GASの応答を解釈できませんでした:', text.slice(0, 120));
      process.exit(1);
    }
    if (json.error) { console.error('GAS error:', json.error); process.exit(1); }
    console.log(`『${json.sheet}』を更新しました (${json.chars}文字, commit ${commit || 'n/a'})`);
  } catch (e) {
    console.error('送信に失敗しました:', e.message);
    process.exit(1);
  }
})();
