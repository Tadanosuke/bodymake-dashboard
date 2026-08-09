#!/usr/bin/env node
// Syncs CLAUDE_MD_MASTER tab (cell A1) from the spreadsheet to local CLAUDE.md via GAS endpoint.
// Usage: npm run sync-claude   (requires GAS_ENDPOINT env var)

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const GAS_ENDPOINT = process.env.GAS_ENDPOINT;
if (!GAS_ENDPOINT) {
  console.error('Error: GAS_ENDPOINT environment variable is not set.');
  process.exit(1);
}

const url        = `${GAS_ENDPOINT}?action=getClaude`;
const claudePath = path.join(__dirname, '..', 'CLAUDE.md');
const lib        = url.startsWith('https') ? https : http;

lib.get(url, (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(raw);
      if (json.error) { console.error('GAS error:', json.error); process.exit(1); }
      if (!json.content) { console.error('No content returned from GAS.'); process.exit(1); }
      fs.writeFileSync(claudePath, json.content, 'utf8');
      console.log('CLAUDE.md synced successfully from CLAUDE_MD_MASTER tab.');
    } catch (e) {
      console.error('Failed to parse GAS response:', e.message);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error('Request failed:', e.message);
  process.exit(1);
});
