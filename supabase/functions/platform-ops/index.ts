// =====================================================================
//  platform-ops — super admin panelining server tomoni.
//
//  NEGA EDGE FUNCTION: ikkita amal `service_role` kalitini talab
//  qiladi va u brauzerga HECH QACHON berilmaydi:
//    · maktab foydalanuvchisi nomidan sessiya olish (texnik yordam)
//    · direktor uchun Auth hisobi yaratish (yangi maktab ulash)
//
//  XAVFSIZLIK NAQSHI (`school-user-ops` dan olingan):
//    1. Chaqiruvchi ANON kalit bilan aniqlanadi — token soxta bo'lsa
//       hech narsa ochilmaydi.
//    2. Uning platforma admini ekani BAZADAN tekshiriladi.
//    3. Barcha tekshiruv va jurnalga yozish RPC ICHIDA bajariladi —
//       bu funksiya qoidalarni O'ZI takrorlamaydi. Shu tufayli qoida
//       o'zgarganda ikki joyni sinxron tutish muammosi yo'q.
//    4. FAQAT SHUNDAN KEYIN service_role mijozi yaratiladi.
//
//  DIQQAT — TOKEN TARTIBI: impersonation claim'lari JWT ga
//  `custom_access_token_hook` tomonidan TOKEN BERILAYOTGANDA
//  qo'yiladi. Shuning uchun sessiya AVVAL ochiladi, token esa
//  KEYIN olinadi. Teskarisi bo'lsa token claim'siz chiqadi va
//  maktab paneli oddiy kirish deb o'ylaydi — sariq banner ham
//  chiqmaydi, jurnalda ham ko'rinmaydi.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  ANON_KEY,
  fail,
  json,
  preflight,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from '../_shared/http.ts';

interface ImpersonatePayload {
  action: 'impersonate';
  school_id: string;
  target_user_id: string;
  mode?: 'read' | 'write';
  reason: string;
  minutes?: number;
}

interface ProvisionPayload {
  action: 'provision_school';
  name: string;
  branch_name?: string;
  login: string;
  director_name?: string;
  plan_code?: string;
  trial_days?: number;
  address?: string;
  phone?: string;
}

interface ResetPayload {
  action: 'reset_director_password';
  school_id: string;
  user_id: string;
}

type Payload = ImpersonatePayload | ProvisionPayload | ResetPayload;

/** Telefon raqamni sintetik pochtaga aylantiradi (panel bilan bir xil). */
function phoneToEmail(raw: string): string {
  return `${raw.replace(/\D/g, '')}@maktab.local`;
}

function looksLikePhone(v: string): boolean {
  return !v.includes('@') && v.replace(/\D/g, '').length >= 9;
}

// ---------------------------------------------------------------------
//  Parol — `scripts/password.mjs` bilan AYNAN bir xil qoida.
//
//  Supabase parol siyosati (harden-auth.mjs) eng kam uzunlik va uch
//  xil belgi sinfini talab qiladi. Tasodifga qoldirilsa Admin API
//  parolni rad etadi va maktab yarim holatda qolib ketadi: `schools`
//  yozuvi bor, direktor hisobi yo'q. Shuning uchun 14 belgi va har
//  sinfdan bittasi KAFOLATLANADI — siyosat qanday bo'lsa ham yetadi.
// ---------------------------------------------------------------------
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const ALL = LOWER + UPPER + DIGIT;

function pick(alphabet: string): string {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return alphabet[b[0] % alphabet.length];
}

function generatePassword(length = 14): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    const j = b[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('Faqat POST', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return fail('Avtorizatsiya sarlavhasi yo\'q', 401);
  }

  // --- 1-qadam: chaqiruvchini aniqlaymiz ---------------------------
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return fail('Token yaroqsiz', 401);

  // --- 2-qadam: platforma adminimi — BAZADAN ------------------------
  //  `platform_admins_select` siyosati `app.is_platform_admin()` ga
  //  bog'langan: admin bo'lmagan odam bu yerdan bo'sh natija oladi.
  const { data: me, error: meErr } = await caller
    .from('platform_admins')
    .select('id, full_name, is_active')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (meErr) return fail(`Profil o'qilmadi: ${meErr.message}`, 403);
  if (!me || !me.is_active) return fail('Bu amal faqat platforma operatori uchun', 403);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return fail('So\'rov JSON emas');
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // =================================================================
  //  TEXNIK YORDAM SESSIYASI
  // =================================================================
  if (body.action === 'impersonate') {
    const { school_id, target_user_id, reason } = body;
    const mode = body.mode === 'write' ? 'write' : 'read';
    const minutes = body.minutes ?? 30;

    if (!school_id || !target_user_id) return fail('Maktab va foydalanuvchi kerak');

    // --- Sessiyani RPC ochadi ------------------------------------
    //  Sabab uzunligi, muddat chegarasi, foydalanuvchi shu maktabdami,
    //  bitta faol sessiya qoidasi va IKKALA JURNAL — hammasi shu
    //  chaqiruv ichida. Bu yerda takrorlanmaydi.
    const { data: session, error: sessErr } = await caller.rpc('start_impersonation', {
      p_school_id: school_id,
      p_target_user_id: target_user_id,
      p_mode: mode,
      p_reason: reason,
      p_minutes: minutes,
    });

    if (sessErr) return fail(sessErr.message, 400);

    // --- Maqsadli foydalanuvchining pochtasi ----------------------
    //  `app_users.email` telefon bilan kiradiganlarda bo'sh bo'ladi,
    //  `auth.users` da esa sintetik pochta har doim mavjud.
    const { data: target, error: targetErr } = await admin.auth.admin
      .getUserById(target_user_id);

    if (targetErr || !target?.user?.email) {
      return fail('Foydalanuvchining pochtasi topilmadi', 404);
    }

    // --- Bir martalik havola → token ------------------------------
    //  Havola POCHTAGA YUBORILMAYDI: `generate_link` uni faqat
    //  qaytaradi. Foydalanuvchining paroliga TEGILMAYDI.
    const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'magiclink', email: target.user.email }),
    });
    const link = await linkRes.json();
    if (!link?.email_otp) {
      return fail(`Havola olinmadi: ${link?.msg ?? link?.error ?? 'noma\'lum xato'}`, 502);
    }

    // Kodni tokenga almashtiramiz. AYNAN SHU PAYTDA
    // `custom_access_token_hook` ishlaydi va JWT ga imp_* claim'larini
    // qo'yadi — sessiya yuqorida ochilgani uchun ular topiladi.
    const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'magiclink',
        email: target.user.email,
        token: link.email_otp,
      }),
    });
    const tokens = await verifyRes.json();
    if (!tokens?.access_token) {
      return fail(`Token olinmadi: ${tokens?.error_description ?? tokens?.msg}`, 502);
    }

    // Claim haqiqatan qo'yildimi — tekshirib qaytaramiz. Qo'yilmagan
    // bo'lsa panel oddiy kirish deb o'ylaydi va banner chiqmaydi;
    // buni jimgina o'tkazib yuborish mumkin emas.
    let claims: Record<string, unknown> = {};
    try {
      claims = JSON.parse(
        atob(tokens.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
    } catch { /* o'qib bo'lmasa quyida xato beriladi */ }

    if (!claims.imp_mode) {
      return fail(
        'Token impersonation claim\'larisiz keldi. `custom_access_token_hook` '
          + 'Auth sozlamalarida yoqilganini tekshiring (scripts/setup-platform.mjs).',
        500,
      );
    }

    return json({
      session,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      mode,
      target_email: target.user.email,
    });
  }

  // =================================================================
  //  YANGI MAKTABNI ULASH
  // =================================================================
  if (body.action === 'provision_school') {
    const { name, login } = body;
    if (!name?.trim()) return fail('Maktab nomi kerak');
    if (!login?.trim()) return fail('Direktor uchun login kerak');

    // --- 1) Maktab + filial + obuna + shablon sozlamalar ----------
    //
    //  DIQQAT — `admin`, `caller` EMAS. `provision_school` ga
    //  `authenticated` roli huquqi ATAYLAB berilmagan (migratsiya 24):
    //  "kerak bo'lmagan huquq berilmaydi" tamoyili, va funksiya
    //  izohida ham "Edge Function orqali, service_role bilan" deb
    //  yozilgan. `caller` bilan chaqirilsa Postgres
    //  `permission denied for function provision_school` beradi.
    //
    //  Chaqiruvchi platforma admini ekani yuqorida allaqachon
    //  tekshirilgan, shuning uchun service_role bilan chaqirish
    //  xavfsiz. Kim ulaganini esa quyida alohida jurnalga yozamiz —
    //  service_role kontekstida `auth.uid()` null bo'ladi.
    const { data: prov, error: provErr } = await admin.rpc('provision_school', {
      p_name: name.trim(),
      p_branch_name: body.branch_name?.trim() || 'Asosiy filial',
      p_plan_code: body.plan_code ?? 'basic',
      p_trial_days: body.trial_days ?? 30,
      p_address: body.address ?? null,
      p_phone: body.phone ?? null,
    });
    if (provErr) return fail(provErr.message, 400);

    const schoolId = (prov as { school_id: string }).school_id;
    const isPhone = looksLikePhone(login);
    const email = isPhone ? phoneToEmail(login) : login.toLowerCase().trim();
    const password = generatePassword();

    // --- 2) Direktor hisobi ---------------------------------------
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: body.director_name?.trim() || 'Direktor' },
    });

    if (createErr || !created?.user) {
      // Maktab yaratildi, hisob yaratilmadi. Maktabni O'CHIRMAYMIZ
      // (TZ 5.4.8) — operator boshqa login bilan qayta urinadi yoki
      // hisobni qo'lda qo'shadi. Xabar shuni aniq aytadi.
      return fail(
        `Maktab yaratildi (${schoolId}), lekin direktor hisobi yaratilmadi: `
          + `${createErr?.message ?? 'noma\'lum xato'}. `
          + 'Bu login band bo\'lishi mumkin.',
        409,
      );
    }

    // --- 3) app_users qatori --------------------------------------
    const { error: linkErr } = await admin.from('app_users').insert({
      id: created.user.id,
      school_id: schoolId,
      role: 'director',
      full_name: body.director_name?.trim() || 'Direktor',
      email: isPhone ? null : email,
      phone: isPhone ? login.replace(/\D/g, '') : (body.phone ?? null),
      all_branches: true,
    });

    if (linkErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return fail(`Direktor biriktirilmadi: ${linkErr.message}`, 500);
    }

    // --- 4) Birinchi hisob-faktura (ulanish to'lovi bilan) --------
    //  Sinov muddati tugagunicha to'lov talab qilinmaydi, lekin
    //  hisob-faktura darhol chiqariladi: direktor birinchi kundanoq
    //  qancha to'lashini bilib tursin.
    const { data: invoice } = await admin.rpc('issue_subscription_invoice', {
      p_school_id: schoolId,
    });

    //  `provision_school` service_role bilan chaqirilgani uchun
    //  `platform_log` da `admin_id` bo'sh qoladi. Kim ulaganini
    //  ALOHIDA yozamiz — chaqiruvchi tokeni bilan, ya'ni yozuvda
    //  haqiqiy operator ko'rinadi.
    await caller.rpc('log_platform_action', {
      p_action: 'school_provisioned_by',
      p_entity: 'schools',
      p_entity_id: schoolId,
      p_school_id: schoolId,
      p_detail: { name: name.trim(), login: isPhone ? login : email },
    });

    return json({
      school_id: schoolId,
      branch_id: (prov as { branch_id: string }).branch_id,
      user_id: created.user.id,
      login: isPhone ? login : email,
      password,
      invoice,
    });
  }

  // =================================================================
  //  DIREKTOR PAROLINI TIKLASH
  // =================================================================
  if (body.action === 'reset_director_password') {
    const { school_id, user_id } = body;
    if (!school_id || !user_id) return fail('Maktab va foydalanuvchi kerak');

    // Foydalanuvchi AYNAN shu maktabdami — so'rovdagi ma'lumotga
    // ishonilmaydi.
    const { data: target, error: targetErr } = await admin
      .from('app_users')
      .select('id, school_id, full_name')
      .eq('id', user_id)
      .eq('school_id', school_id)
      .maybeSingle();

    if (targetErr || !target) return fail('Foydalanuvchi bu maktabda topilmadi', 404);

    const password = generatePassword();
    const { error: updErr } = await admin.auth.admin.updateUserById(user_id, { password });
    if (updErr) return fail(`Parol o'zgartirilmadi: ${updErr.message}`, 500);

    // Jurnalsiz qolmasin — bu maktab hisobiga aralashuv.
    await caller.rpc('log_platform_action', {
      p_action: 'director_password_reset',
      p_entity: 'app_users',
      p_entity_id: user_id,
      p_school_id: school_id,
      p_detail: { full_name: target.full_name },
    });

    return json({ user_id, password, full_name: target.full_name });
  }

  return fail('Noma\'lum amal');
});
