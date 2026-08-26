#!/usr/bin/env node
// =====================================================================
//  db.mjs — migratsiyalarni jonli Supabase loyihasiga qo'llaydi.
//
//  NEGA `supabase db push` EMAS: `db push` bazaga to'g'ridan-to'g'ri
//  ulanadi va DB parolini talab qiladi. Bu skript esa Management API
//  orqali ishlaydi — faqat access token yetarli.
//
//  Migratsiya tarixi `supabase_migrations.schema_migrations` jadvalida
//  yuritiladi — bu Supabase CLI ishlatadigan AYNAN O'SHA jadval.
//  Shuning uchun keyinchalik `supabase db push` ga o'tsangiz, u bu
//  migratsiyalarni "allaqachon qo'llangan" deb ko'radi va takrorlamaydi.
//
//  Buyruqlar:
//    node scripts/db.mjs status     — qaysi migratsiya qo'llangan
//    node scripts/db.mjs push       — kutayotganlarini qo'llash
//    node scripts/db.mjs sql "..."  — bitta so'rov (tekshirish uchun)
//    node scripts/db.mjs file x.sql — bitta fayl (tarixga yozilmaydi)
// =====================================================================

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

// --- .env.local ni o'qish (tashqi kutubxonasiz) ---------------------
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
  console.error(
    'XATO: .env.local da SUPABASE_ACCESS_TOKEN va SUPABASE_PROJECT_REF bo\'lishi kerak.',
  );
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

/** Bitta SQL so'rovni bajaradi. Xato bo'lsa `Error` tashlaydi. */
async function query(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Javob JSON emas (HTTP ${res.status}): ${text.slice(0, 400)}`);
  }

  if (!res.ok || (body && body.message)) {
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return body;
}

/** CLI bilan bir xil tarix jadvali. */
async function ensureHistoryTable() {
  await query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version    text primary key,
      statements text[],
      name       text
    );
  `);
}

async function appliedVersions() {
  const rows = await query(
    'select version from supabase_migrations.schema_migrations order by version',
  );
  return new Set((rows ?? []).map((r) => r.version));
}

async function migrationFiles() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((f) => {
    const m = f.match(/^(\d+)_(.+)\.sql$/);
    return { file: f, version: m ? m[1] : f.replace('.sql', ''), name: m ? m[2] : f };
  });
}

/** SQL matnidagi ' ni ikkilantirib, literal ichiga qo'yish uchun tayyorlaydi. */
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function cmdStatus() {
  await ensureHistoryTable();
  const applied = await appliedVersions();
  const files = await migrationFiles();

  console.log(`\nLoyiha: ${REF}\n`);
  for (const f of files) {
    const mark = applied.has(f.version) ? '  ✓' : '  ·';
    const state = applied.has(f.version) ? 'qo\'llangan' : 'KUTMOQDA';
    console.log(`${mark} ${f.version}  ${f.name.padEnd(34)} ${state}`);
  }
  const pending = files.filter((f) => !applied.has(f.version));
  console.log(
    `\n${files.length} ta migratsiya, ${pending.length} tasi kutmoqda.\n`,
  );
}

async function cmdPush() {
  await ensureHistoryTable();
  const applied = await appliedVersions();
  const files = await migrationFiles();
  const pending = files.filter((f) => !applied.has(f.version));

  if (pending.length === 0) {
    console.log('Hammasi qo\'llangan — yangi migratsiya yo\'q.');
    return;
  }

  console.log(`${pending.length} ta migratsiya qo'llanadi...\n`);

  for (const f of pending) {
    const sql = await readFile(join(MIGRATIONS_DIR, f.file), 'utf8');
    process.stdout.write(`  → ${f.file} ... `);
    try {
      // Migratsiya + tarix yozuvi BITTA tranzaksiyada. Migratsiya
      // yiqilsa tarixga ham yozilmaydi — qayta urinish mumkin bo'ladi.
      await query(
        `begin;\n${sql}\n
         insert into supabase_migrations.schema_migrations (version, name)
         values (${lit(f.version)}, ${lit(f.name)})
         on conflict (version) do nothing;
         commit;`,
      );
      console.log('OK');
    } catch (err) {
      console.log('XATO');
      console.error(`\n  ${f.file}:\n  ${err.message}\n`);
      process.exit(1);
    }
  }
  console.log('\nBarcha migratsiyalar qo\'llandi.\n');
}

async function cmdSql(sql) {
  const rows = await query(sql);
  console.log(JSON.stringify(rows, null, 2));
}

async function cmdFile(path) {
  const sql = await readFile(path, 'utf8');
  const rows = await query(sql);
  console.log(JSON.stringify(rows, null, 2));
}

const [cmd, arg] = process.argv.slice(2);

try {
  if (cmd === 'status') await cmdStatus();
  else if (cmd === 'push') await cmdPush();
  else if (cmd === 'sql') await cmdSql(arg);
  else if (cmd === 'file') await cmdFile(arg);
  else {
    console.log('Buyruqlar: status | push | sql "<so\'rov>" | file <yo\'l>');
    process.exit(1);
  }
} catch (err) {
  console.error(`\nXATO: ${err.message}\n`);
  process.exit(1);
}
