#!/usr/bin/env node
// =====================================================================
//  smoke-platform.mjs — platforma qatlamining HAR BIR so'rovini
//  haqiqiy token bilan tekshiradi.
//
//  NEGA KERAK: `npm run build` faqat TypeScript xatolarini topadi,
//  `test-platform.sql` esa bazani `postgres` roli ostida sinaydi.
//  Ikkalasi ham SEZMAYDIGAN xatolar bor:
//    · RLS siyosati so'rovni to'sib qo'yishi
//    · PostgREST orqali funksiya ko'rinmasligi (grant unutilgan)
//    · yaratilgan turlar bilan haqiqiy javob mos kelmasligi
//
//  Skript ikki rolni tekshiradi:
//    1. SUPER ADMIN — hamma narsani ko'radimi
//    2. DIREKTOR    — o'z obunasini ko'radimi va BEGONA narsani
//                     ko'rmasligi kerak
//
//  Ishga tushirish:
//    node scripts/smoke-platform.mjs <admin-email> <direktor-email>
//
//  Parol so'ralmaydi: `service_role` kaliti bilan bir martalik
//  sehrli havola yaratiladi va tokenga almashtiriladi. Hech kimning
//  paroli O'ZGARMAYDI.
// =====================================================================

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function loadEnv() {
  for (const file of ['.env.local', 'apps/super-admin/.env.production']) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    const text = await readFile(path, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}
await loadEnv();

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const [adminEmail, directorEmail] = process.argv.slice(2);
if (!adminEmail) {
  console.error('\nFoydalanish: node scripts/smoke-platform.mjs <admin-email> [direktor-email]\n');
  process.exit(1);
}

/** Parolsiz kirish — bir martalik havola tokenga almashtiriladi. */
async function tokenFor(email) {
  const linkRes = await fetch(`${URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const link = await linkRes.json();
  if (!link?.email_otp) throw new Error(link?.msg ?? 'havola olinmadi');

  const verifyRes = await fetch(`${URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email, token: link.email_otp }),
  });
  const auth = await verifyRes.json();
  if (!auth?.access_token) throw new Error(auth?.error_description ?? 'token olinmadi');
  return auth.access_token;
}

let pass = 0;
const failures = [];

function headers(token) {
  return { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** SELECT so'rovi. `expect` berilsa qatorlar soni tekshiriladi. */
async function rest(token, label, path, expect) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: headers(token) });
  const text = await res.text();
  if (!res.ok) {
    failures.push({ label, detail: text.slice(0, 200) });
    console.log(`  ✗ ${label}`);
    return null;
  }
  const data = JSON.parse(text);
  const n = Array.isArray(data) ? data.length : 1;

  if (expect === 'empty' && n !== 0) {
    failures.push({ label, detail: `${n} ta qator qaytdi, BO'SH kutilgan edi` });
    console.log(`  ✗ ${label.padEnd(48)} ${n} (bo'sh bo'lishi kerak edi)`);
    return data;
  }
  if (expect === 'some' && n === 0) {
    failures.push({ label, detail: "bo'sh qaytdi, ma'lumot kutilgan edi" });
    console.log(`  ✗ ${label.padEnd(48)} 0 (ma'lumot kutilgan edi)`);
    return data;
  }

  pass++;
  console.log(`  ✓ ${label.padEnd(48)} ${n}`);
  return data;
}

/** RPC. `expectFail` — chaqiruv RAD ETILISHI kerak. */
async function rpc(token, label, fn, body = {}, expectFail = false) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: headers(token), body: JSON.stringify(body),
  });
  const text = await res.text();

  if (expectFail) {
    if (res.ok) {
      failures.push({ label, detail: 'chaqiruv OTDI — rad etilishi kerak edi' });
      console.log(`  ✗ ${label.padEnd(48)} o'tdi (rad etilishi kerak edi)`);
      return null;
    }
    pass++;
    console.log(`  ✓ ${label.padEnd(48)} rad etildi`);
    return null;
  }

  if (!res.ok) {
    failures.push({ label, detail: text.slice(0, 200) });
    console.log(`  ✗ ${label}`);
    return null;
  }
  pass++;
  const data = text ? JSON.parse(text) : null;
  console.log(`  ✓ ${label.padEnd(48)} ${Array.isArray(data) ? data.length : 'ok'}`);
  return data;
}

// =====================================================================
//  1. SUPER ADMIN
// =====================================================================

console.log(`\n=== SUPER ADMIN: ${adminEmail} ===\n`);
const adminToken = await tokenFor(adminEmail);

await rest(adminToken, 'platform_admins', 'platform_admins?select=id,full_name', 'some');
await rest(adminToken, 'platform_settings', 'platform_settings?select=key,value', 'some');
await rest(adminToken, 'schools (barchasi)', 'schools?select=id,name,status', 'some');
await rest(adminToken, 'school_subscriptions', 'school_subscriptions?select=id,status');
await rest(adminToken, 'subscription_invoices', 'subscription_invoices?select=id,period,total_amount');
await rest(adminToken, 'subscription_payments', 'subscription_payments?select=id,status');
await rest(adminToken, 'support_threads', 'support_threads?select=id,subject');
await rest(adminToken, 'support_messages', 'support_messages?select=id,body');
await rest(adminToken, 'platform_log', 'platform_log?select=id,action&limit=5');
await rest(adminToken, 'impersonation_log', 'impersonation_log?select=id,action&limit=5');
await rest(adminToken, 'plans', 'plans?select=code,name');

const schools = await rpc(adminToken, 'platform_schools()', 'platform_schools');
await rpc(adminToken, 'platform_overview()', 'platform_overview');
await rpc(adminToken, 'platform_revenue(12)', 'platform_revenue', { p_months: 12 });

const schoolId = schools?.[0]?.school_id;
if (schoolId) {
  await rpc(adminToken, 'platform_school_card()', 'platform_school_card', { p_school_id: schoolId });
  await rpc(adminToken, 'school_price()', 'school_price', { p_school_id: schoolId });
  await rpc(adminToken, 'school_users()', 'school_users', { p_school_id: schoolId });
}

// Validatsiya haqiqatan ishlaydimi — qisqa sabab rad etilishi kerak.
if (schoolId) {
  await rpc(adminToken, 'start_impersonation (qisqa sabab)', 'start_impersonation', {
    p_school_id: schoolId,
    p_target_user_id: '00000000-0000-0000-0000-000000000000',
    p_mode: 'read', p_reason: 'qisqa', p_minutes: 30,
  }, true);

  await rpc(adminToken, 'set_school_status (sababsiz)', 'set_school_status', {
    p_school_id: schoolId, p_status: 'active', p_reason: '',
  }, true);
}

// =====================================================================
//  2. MAKTAB DIREKTORI
// =====================================================================

if (directorEmail) {
  console.log(`\n=== DIREKTOR: ${directorEmail} ===\n`);
  const dirToken = await tokenFor(directorEmail);

  await rest(dirToken, 'o\'z maktabi', 'schools?select=id,name,status', 'some');
  await rest(dirToken, 'o\'z obunasi', 'school_subscriptions?select=id,status,monthly_amount', 'some');
  await rest(dirToken, 'narx parametrlari (ochiq)', 'platform_settings?select=key,value', 'some');
  await rest(dirToken, 'o\'z hisob-fakturalari', 'subscription_invoices?select=id,period,total_amount');
  await rest(dirToken, 'o\'z cheklari', 'subscription_payments?select=id,status');
  await rest(dirToken, 'o\'z yozishmasi', 'support_threads?select=id,subject');

  // --- Ko'rmasligi KERAK bo'lganlar --------------------------------
  await rest(dirToken, 'platform_log (ko\'rinmasligi kerak)', 'platform_log?select=id', 'empty');
  await rest(dirToken, 'platform_admins (ko\'rinmasligi kerak)', 'platform_admins?select=id', 'empty');

  // --- Chaqira olmasligi KERAK bo'lganlar --------------------------
  await rpc(dirToken, 'platform_overview() (rad etilishi kerak)', 'platform_overview', {}, true);
  await rpc(dirToken, 'platform_schools() (rad etilishi kerak)', 'platform_schools', {}, true);
  await rpc(dirToken, 'set_platform_setting() (rad etilishi kerak)', 'set_platform_setting', {
    p_key: 'billing.base_monthly', p_value: 1,
  }, true);
  await rpc(dirToken, 'record_subscription_payment() (rad etilishi kerak)',
    'record_subscription_payment', { p_school_id: schoolId, p_amount: 1 }, true);

  // --- Chaqira OLISHI kerak ----------------------------------------
  const me = await rest(dirToken, 'o\'z maktab id si', 'app_users?select=school_id&limit=1');
  const mySchool = me?.[0]?.school_id;
  if (mySchool) {
    await rpc(dirToken, 'school_price() (o\'zi uchun)', 'school_price', { p_school_id: mySchool });
  }
}

// =====================================================================
console.log('');
if (failures.length === 0) {
  console.log(`✓ ${pass} ta tekshiruv — hammasi o'tdi\n`);
  process.exit(0);
}

console.log(`✗ ${failures.length} ta xato (${pass} tasi o'tdi):\n`);
for (const f of failures) console.log(`  ${f.label}\n    ${f.detail}\n`);
process.exit(1);
