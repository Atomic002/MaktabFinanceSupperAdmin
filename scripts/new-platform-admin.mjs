#!/usr/bin/env node
// =====================================================================
//  new-platform-admin.mjs — super admin hisobini yaratadi (TZ M5).
//
//  NEGA SKRIPT, PANEL EMAS: `platform_admins` jadvalida INSERT
//  siyosati ATAYLAB yo'q (TZ 5.4.11). Ya'ni bu jadvalga ilova orqali
//  yozib bo'lmaydi — hech qanday yo'l bilan. Yangi super admin faqat
//  `service_role` kaliti bo'lgan odam tomonidan qo'shiladi, kalit esa
//  faqat `.env.local` da va CI da yo'q.
//
//  Bu qasddan noqulay qilingan: super admin BARCHA maktablarni
//  ko'radi. Uni qo'shish oson bo'lmasligi kerak.
//
//  Ishga tushirish:
//    node scripts/new-platform-admin.mjs "To'liq ism" admin@uztomic.uz
//    node scripts/new-platform-admin.mjs "To'liq ism" admin@uztomic.uz --phone 998901234567
//
//  Mavjud hisobni super admin qilish uchun ham shu skript ishlaydi:
//  pochta band bo'lsa yangi hisob yaratilmaydi, mavjudi topiladi va
//  `platform_admins` ga qo'shiladi.
// =====================================================================

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generatePassword } from './password.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const URL_BASE = `https://${REF}.supabase.co`;

if (!REF || !TOKEN || !SERVICE_KEY) {
  console.error(
    "XATO: .env.local da SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN va "
    + "SUPABASE_SERVICE_ROLE_KEY bo'lishi kerak.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const phoneIdx = args.indexOf('--phone');
const phone = phoneIdx >= 0 ? args[phoneIdx + 1] : null;
const positional = args.filter((a, i) => {
  if (a === '--phone') return false;
  if (phoneIdx >= 0 && i === phoneIdx + 1) return false;
  return !a.startsWith('--');
});

const [fullName, email] = positional;

if (!fullName || !email) {
  console.log(
    '\nFoydalanish:\n'
    + '  node scripts/new-platform-admin.mjs "To\'liq ism" <email> [--phone 998901234567]\n\n'
    + 'Misol:\n'
    + '  node scripts/new-platform-admin.mjs "Alisher Karimov" alisher@uztomic.uz\n',
  );
  process.exit(1);
}

if (!email.includes('@')) {
  console.error("\nXATO: super admin uchun HAQIQIY pochta kerak — parolni\n"
    + "tiklash faqat pochta orqali ishlaydi.\n");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok || body?.message) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body;
}

const lit = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

// ---------------------------------------------------------------------
console.log(`\nSuper admin qo'shilmoqda: ${fullName} <${email}>\n`);

const normalized = email.toLowerCase().trim();
const password = generatePassword();
let userId = null;
let created = false;

// --- 1) Auth hisobi ---------------------------------------------------
const authRes = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: normalized,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  }),
});

const authBody = await authRes.json();

if (authRes.ok) {
  userId = authBody.id;
  created = true;
  console.log('  ✓ Auth hisobi yaratildi');
} else {
  // Pochta band — mavjud hisobni topamiz. Bu normal holat: maktab
  // xodimi emas, lekin allaqachon tizimda bo'lgan odamni super admin
  // qilish kerak bo'lishi mumkin.
  const listRes = await fetch(
    `${URL_BASE}/auth/v1/admin/users?page=1&per_page=200`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  const list = await listRes.json();
  const found = (list?.users ?? []).find(
    (u) => (u.email ?? '').toLowerCase() === normalized,
  );

  if (!found) {
    console.error(`\nXATO: hisob yaratilmadi — ${authBody?.msg ?? authBody?.message}\n`);
    process.exit(1);
  }

  userId = found.id;
  console.log('  · Auth hisobi allaqachon bor — mavjudi ishlatiladi');
}

// --- 2) platform_admins qatori ---------------------------------------
//  `on conflict do update` — allaqachon qo'shilgan odamni qayta faol
//  qilish uchun. Yozuv O'CHIRILMAYDI (TZ 5.4.8), `is_active = false`
//  qilinadi; bu skript uni qaytaradi.
await sql(`
  insert into public.platform_admins (id, full_name, email, phone, is_active)
  values (${lit(userId)}, ${lit(fullName)}, ${lit(normalized)}, ${lit(phone)}, true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email     = excluded.email,
        phone     = coalesce(excluded.phone, public.platform_admins.phone),
        is_active = true;
`);

console.log('  ✓ platform_admins ga qo\'shildi\n');

// --- 3) Tekshiruv -----------------------------------------------------
//  "Qo'shildi" degan xabar yetarli emas — funksiya HAQIQATAN true
//  qaytarishini ko'ramiz. Aks holda odam panelga kirib bo'sh ekran
//  ko'radi va sababini bilmaydi.
const [check] = await sql(`
  select
    (select count(*) from public.platform_admins where id = ${lit(userId)} and is_active) as bor,
    (select count(*) from public.app_users where id = ${lit(userId)}) as maktab_xodimi
`);

if (Number(check.bor) !== 1) {
  console.error('XATO: yozuv qo\'shilmadi. Bazani tekshiring.\n');
  process.exit(1);
}

if (Number(check.maktab_xodimi) > 0) {
  console.log('  ⚠️  DIQQAT: bu hisob AYNI PAYTDA maktab xodimi ham.');
  console.log('     Super admin va maktab xodimi bir hisobda bo\'lmasligi kerak —');
  console.log('     `app.school_id()` qiymat qaytaradi va hisobotlar chalkashadi.\n');
}

console.log('─'.repeat(56));
console.log('  KIRISH MA\'LUMOTLARI');
console.log('─'.repeat(56));
console.log(`  Panel : https://maktabfinanceadmin.uztomic.uz`);
console.log(`  Login : ${normalized}`);
console.log(`  Parol : ${created ? password : '(o\'zgarmadi — mavjud hisob)'}`);
console.log('─'.repeat(56));

if (created) {
  console.log('\n  ⚠️  Parol faqat HOZIR ko\'rsatiladi. Uni saqlab qo\'ying.');
}
console.log('');
