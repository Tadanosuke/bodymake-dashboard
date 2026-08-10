#!/usr/bin/env node
// Generates a local sheet admin token and stores it in .env.local.
// Set the same value manually in Apps Script project settings:
// Script property name: SHEET_ADMIN_TOKEN

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');

function valueFromEnvFile(name) {
  if (!fs.existsSync(envPath)) return '';
  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(name + '='));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

function upsertEnv(name, value) {
  const lines = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.trim().startsWith(name + '=')) {
      found = true;
      return `${name}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] !== '') next.push('');
    next.push(`${name}=${value}`);
  }
  fs.writeFileSync(envPath, next.join('\n').replace(/\n*$/, '\n'), 'utf8');
}

const token = valueFromEnvFile('SHEET_ADMIN_TOKEN') || crypto.randomBytes(32).toString('hex');
upsertEnv('SHEET_ADMIN_TOKEN', token);
console.log('SHEET_ADMIN_TOKEN configured in .env.local.');
console.log('Set the same value in Apps Script project settings > Script properties.');
