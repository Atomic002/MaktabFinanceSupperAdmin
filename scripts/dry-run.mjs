#!/usr/bin/env node
// =====================================================================
//  dry-run.mjs — migratsiyani JONLI bazada sinab ko'radi, lekin
//  hech narsani saqlamaydi.
//
//  NEGA KERAK: bu migratsiyalar 100 dan ortiq RLS siyosatini qayta
//  yozadi va ishlayotgan maktab ma'lumoti ustida bajariladi. "Push
//  qilib ko'ramiz, xato bo'lsa qaytaramiz" bu yerda ishlamaydi —
//  siyosat noto'g'ri tiklansa maktab ma'lumotini ko'rmay qoladi.
//
//  Skript faylni `begin; ... rollback;` ichiga o'rab yuboradi.
//  Sintaksis, ustun nomlari, funksiya imzolari va `raise exception`
//  bilan yozilgan tekshiruvlar — hammasi HAQIQIY bazada bajariladi,
//  natija esa bekor qilinadi.
//
//    node scripts/dry-run.mjs supabase/migrations/xxx.sql
//    node scripts/dry-run.mjs --all
// =====================================================================

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

async function loadEnv() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return;
  const text = await readFile(path, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
await loadEnv();

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error("XATO: .env.local da SUPABASE_ACCESS_TOKEN va SUPABASE_PROJECT_REF bo'lishi kerak.");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function query(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Javob JSON emas (HTTP ${res.status}): ${text.slice(0, 400)}`);
  }
  if (!res.ok || (body && body.message)) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body;
}

const arg = process.argv[2];
if (!arg) {
  console.log('\nFoydalanish: node scripts/dry-run.mjs <fayl.sql> | --all\n');
  process.exit(1);
}

let files;
if (arg === '--all') {
  files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(MIGRATIONS_DIR, f));
} else {
  files = [arg];
}

let failed = 0;

for (const file of files) {
  const sql = await readFile(file, 'utf8');
  const name = file.replace(/\\/g, '/').split('/').pop();
  process.stdout.write(`  → ${name.padEnd(44)} `);
  try {
    // Bitta tranzaksiya: migratsiya bajariladi va DARHOL bekor
    // qilinadi. Bazada iz qolmaydi.
    await query(`begin;\n${sql}\nrollback;`);
    console.log('OK');
  } catch (err) {
    failed++;
    console.log('XATO');
    console.error(`\n     ${err.message}\n`);
  }
}

console.log(
  failed === 0
    ? `\n${files.length} ta fayl tekshirildi — xato yo'q.\n`
    : `\n${failed} ta faylda xato.\n`,
);
process.exit(failed ? 1 : 0);
