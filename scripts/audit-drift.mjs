#!/usr/bin/env node
// =====================================================================
//  audit-drift.mjs — baza va repo bir-biriga MOS kelayotganini tekshiradi.
//
//  NEGA KERAK. 2026-08-26 da shunday hol yuz berdi: super admin qismi
//  jonli bazaga qo'llangan, lekin migratsiya fayllari asosiy repoda
//  yo'q edi. Baza ishlardi, panel ishlardi, barcha auditlar "toza"
//  derdi. Nomuvofiqlik faqat TOZA BAZAGA ko'chirganda chiqardi — ya'ni
//  eng noqulay paytda.
//
//  BU REPO NIMAGA JAVOB BERADI. Baza IKKI repo tomonidan bo'lishiladi:
//
//    · maktab qismi   → `Xususiy Maktablar Moliya  Tizmi`
//    · platforma qismi → SHU REPO (obuna, tariflash, muloqot,
//                        impersonation, platforma hisobotlari)
//
//  Shuning uchun "bazada bor, repoda yo'q" tekshiruvi HAMMA obyektni
//  emas, faqat SHU REPO EGALIK QILADIGANLARINI ko'radi. Aks holda
//  audit 50 ta maktab jadvalini "yo'qolgan" deb ko'rsatib, doim qizil
//  bo'lib turardi — va odamlar unga qarashni to'xtatardi.
//
//  Ishlatish:  node scripts/audit-drift.mjs
// =====================================================================

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

// ---------------------------------------------------------------------
//  SHU REPO EGALIK QILADIGAN OBYEKTLAR
//
//  Ro'yxat QO'LDA yuritiladi va bu ataylab: yangi platforma obyekti
//  qo'shilganda uni shu yerga ham yozish kerak. Bir qatorlik ish, lekin
//  u "obyekt bor, migratsiyasi yo'q" holatini butunlay yopadi.
// ---------------------------------------------------------------------

const OWNED_TABLES = [
  'platform_settings',
  'subscription_invoices',
  'subscription_payments',
  'support_threads',
  'support_messages',
];

const OWNED_ENUMS = [
  'subscription_invoice_status',
  'subscription_payment_status',
  'support_thread_status',
  'support_priority',
];

const OWNED_FUNCTIONS = [
  // app.*
  'billing_num', 'plog', 'require_platform_admin', 'recompute_school_billing',
  'apply_subscription_payment', 'support_post', 'notify_school',
  // public.*
  'school_price', 'set_school_status', 'set_school_plan',
  'issue_subscription_invoice', 'record_subscription_payment',
  'submit_subscription_payment', 'review_subscription_payment',
  'set_platform_setting', 'log_platform_action',
  'start_impersonation', 'end_impersonation', 'school_users',
  'open_support_thread', 'post_support_message',
  'set_support_thread_status', 'mark_support_read',
  'run_billing_cycle', 'update_school_profile',
  'platform_schools', 'platform_overview', 'platform_revenue',
  'platform_school_card',
];

//  QAYSI MIGRATSIYA BIZNIKI.
//
//  Ilgari bu vaqt uyasi bo'yicha aniqlanardi: "bu repo `15` ni
//  oladi, asosiy repo `12`-`14` ni". Kelishuv BUZILDI —
//  2026-08-31 da asosiy repo bir kunda `12` dan `23` gacha
//  o'ntadan ortiq migratsiya yozdi va `15` ni ham egalladi.
//  Natijada bu audit begona migratsiyani "meniki, fayli yo'q" deb
//  ko'rsata boshladi.
//
//  Kelishuvga tayanish noto'g'ri edi: u ikkala repo yozuvchisining
//  esida turishini talab qiladi. Endi HAQIQAT tekshiriladi — qo'shni
//  reponing migratsiya papkasiga qaraladi. U yerda fayl bo'lsa,
//  versiya begona.
//
//  Qo'shni repo topilmasa (masalan CI da faqat shu repo bor),
//  tekshiruv o'tkazib yuboriladi va bu ochiq aytiladi — jimgina
//  "hammasi joyida" deb turishdan ko'ra.
const SIBLING = join(ROOT, '..', '..', 'Xususiy Maktablar Moliya  Tizmi',
                     'supabase', 'migrations');

/** Qo'shni repodagi migratsiya versiyalari. Topilmasa — null. */
function siblingVersions() {
  if (!existsSync(SIBLING)) return null;
  return new Set(
    readdirSync(SIBLING)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => (f.match(/^(\d+)_/) ?? [])[1])
      .filter(Boolean),
  );
}

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
  console.error("XATO: .env.local da SUPABASE_ACCESS_TOKEN va SUPABASE_PROJECT_REF kerak.");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
  );
  const body = JSON.parse(await res.text());
  if (!res.ok || body?.message) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body;
}

// --- Migratsiya fayllarining butun matni -----------------------------
const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
const texts = await Promise.all(files.map((f) => readFile(join(MIGRATIONS, f), 'utf8')));
const corpus = texts.join('\n').toLowerCase();

//  Nom matnda umuman uchraydimi? Bu QO'POL, lekin ataylab shunday:
//  aniq DDL tahlili murakkab va noto'g'ri xavotir beradi. Savol oddiy —
//  "bu obyekt haqida repoda biror joyda gap boradimi?"
const inRepo = (name) => corpus.includes(name.toLowerCase());

const problems = [];

// --- 1. Bizniki, lekin repoda tavsiflanmagan --------------------------
const dbTables = new Set((await sql(`
  select table_name as name from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE';
`)).map((r) => r.name));

const dbEnums = new Set((await sql(`
  select t.typname as name from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and t.typtype = 'e';
`)).map((r) => r.name));

const dbFuncs = new Set((await sql(`
  select distinct p.proname as name
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app');
`)).map((r) => r.name));

for (const [kind, owned, present] of [
  ['jadval',    OWNED_TABLES,    dbTables],
  ['enum',      OWNED_ENUMS,     dbEnums],
  ['funksiya',  OWNED_FUNCTIONS, dbFuncs],
]) {
  for (const name of owned) {
    if (!present.has(name)) {
      problems.push(`repoda bor, BAZADA YO'Q — ${kind}: ${name} (migratsiya qo'llanmagan?)`);
    } else if (!inRepo(name)) {
      problems.push(`bazada bor, REPODA YO'Q — ${kind}: ${name} (migratsiya yozilmagan)`);
    }
  }
}

// --- 2. Faylda bor, tarixda yo'q --------------------------------------
const applied = new Set(
  (await sql('select version from supabase_migrations.schema_migrations;'))
    .map((r) => r.version),
);
const versions = files.map((f) => (f.match(/^(\d+)_/) ?? [])[1]).filter(Boolean);

for (const [i, v] of versions.entries()) {
  if (!applied.has(v)) problems.push(`qo'llanmagan migratsiya: ${files[i]}`);
}

// --- 3. Tarixda bizniki bor, faylda yo'q ------------------------------
//  Eng xavflisi shu: baza fayllardan oldinda va toza baza BOSHQACHA
//  quriladi. Faqat BIZNING oraliqdagi versiyalar tekshiriladi.
const known = new Set(versions);
const sib = siblingVersions();
let foreign = 0;

for (const v of [...applied].sort()) {
  if (known.has(v)) continue;
  //  Qo'shni repoda fayli bormi? Bor bo'lsa — begona, hammasi joyida.
  if (sib && sib.has(v)) { foreign++; continue; }
  if (!sib) { foreign++; continue; }   // qo'shni repo topilmadi — quyida aytiladi
  problems.push(`tarixda bor, HECH QAYSI repoda fayli yo'q: ${v}`);
}

// --- Natija ------------------------------------------------------------
console.log(`\nMigratsiya fayli: ${files.length}, tarixda jami: ${applied.size}`);
console.log(`Asosiy reponiki (tekshirilmadi): ${foreign}`);
console.log(`Egalik qilinadigan obyekt: ${OWNED_TABLES.length} jadval, `
  + `${OWNED_ENUMS.length} enum, ${OWNED_FUNCTIONS.length} funksiya`);

if (!sib) {
  console.log("DIQQAT: qo'shni repo topilmadi — begona migratsiyalar tekshirilmadi.");
}

if (problems.length === 0) {
  console.log('\n  ✓ Baza va repo mos — toza bazada ham shu holat quriladi\n');
  process.exit(0);
}

console.log(`\n  ${problems.length} ta nomuvofiqlik:\n`);
for (const p of problems) console.log(`   · ${p}`);
console.log('');
process.exit(1);
