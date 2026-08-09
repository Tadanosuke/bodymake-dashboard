#!/usr/bin/env node
// Syncs CLAUDE_MD_MASTER tab (cell A1) from the spreadsheet to local CLAUDE.md via GAS endpoint.
// Usage: npm run sync-claude
// Endpoint is read from the GAS_ENDPOINT env var, or from .env.local if unset.

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const claudePath = path.join(__dirname, '..', 'CLAUDE.md');
const envPath    = path.join(__dirname, '..', '.env.local');

function endpointFromEnvFile() {
  if (!fs.existsSync(envPath)) return '';
  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find(l => l.trim().startsWith('GAS_ENDPOINT='));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const GAS_ENDPOINT = (process.env.GAS_ENDPOINT || endpointFromEnvFile()).trim();
if (!GAS_ENDPOINT) {
  console.error('Error: GAS_ENDPOINT is not set.');
  console.error('Add a line to .env.local:  GAS_ENDPOINT=https://script.google.com/macros/s/.../exec');
  process.exit(1);
}

const url = `${GAS_ENDPOINT}?action=getClaude`;

// GASの /exec は googleusercontent.com へ302リダイレクトするので追従する
function get(target, redirectsLeft, cb) {
  const lib = target.startsWith('https') ? https : http;
  lib.get(target, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      if (redirectsLeft <= 0) return cb(new Error('Too many redirects'));
      res.resume();
      return get(res.headers.location, redirectsLeft - 1, cb);
    }
    let raw = '';
    res.setEncoding('utf8');
    res.on('data', chunk => raw += chunk);
    res.on('end', () => cb(null, raw));
  }).on('error', cb);
}
get(url, 5, (err, raw) => {
  if (err) { console.error('Request failed:', err.message); process.exit(1); }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse GAS response:', e.message);
    console.error('Response head:', String(raw).slice(0, 120));
    process.exit(1);
  }
  if (json.error)    { console.error('GAS error:', json.error); process.exit(1); }
  if (!json.content) { console.error('No content returned from GAS.'); process.exit(1); }
  fs.writeFileSync(claudePath, json.content, 'utf8');
  console.log('CLAUDE.md synced successfully from CLAUDE_MD_MASTER tab.');
});
