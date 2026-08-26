-- =====================================================================
--  43 — TEXNIK YORDAM SESSIYASI VA YOZISHMA FUNKSIYALARI
--
--  MUAMMO: `impersonation_sessions` jadvali bor, JWT hook ham
--  yozilgan, `app.is_readonly_session()` ham har bir yozuv siyosatida
--  tekshiriladi. Lekin sessiyani OCHADIGAN funksiya yo'q — jadvalda
--  INSERT siyosati ham yo'q. Ya'ni mexanizm to'liq qurilgan, kaliti
--  yo'q.
--
--  DIQQAT — TOKEN VA SESSIYA MUDDATI: JWT dagi claim'lar sessiya
--  yopilgandan keyin ham token muddati tugaguncha amal qiladi.
--  Shuning uchun `app.is_readonly_session()` `imp_exp` ni HAM
--  tekshiradi va sessiya muddati tokendan qisqa bo'lishi shart.
--  Bu yerda yuqori chegara 120 daqiqa — Supabase tokeni 1 soat va
--  yangilanib turadi, shuning uchun sessiya muddati o'tgach yangi
--  token claim'siz keladi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SESSIYANI OCHISH (TZ M1)
-- ---------------------------------------------------------------------

create or replace function public.start_impersonation(
  p_school_id      uuid,
  p_target_user_id uuid,
  p_mode           public.impersonation_mode default 'read',
  p_reason         text default null,
  p_minutes        int  default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin   uuid := app.require_platform_admin();
  v_id      uuid;
  v_expires timestamptz;
  v_closed  int;
  v_target  record;
begin
  -- --- Sabab. `read` rejimida ham majburiy -------------------------
  --  Jadval cheklovi faqat `write` uchun talab qiladi, TZ esa har
  --  qanday sessiya uchun. Kuchliroq shartni funksiya qo'yadi.
  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'Sabab ko''rsatilishi shart (kamida 10 belgi)'
      using errcode = '22023';
  end if;

  if p_minutes < 5 or p_minutes > 120 then
    raise exception 'Sessiya muddati 5 dan 120 daqiqagacha bo''lishi kerak'
      using errcode = '22023';
  end if;

  -- --- Maqsadli foydalanuvchi AYNAN shu maktabdami ------------------
  select u.id, u.full_name, u.role, u.school_id
    into v_target
    from public.app_users u
   where u.id = p_target_user_id
     and u.school_id = p_school_id
     and u.is_active
     and u.deleted_at is null;

  if not found then
    raise exception 'Foydalanuvchi bu maktabda topilmadi yoki faol emas'
      using errcode = 'P0002';
  end if;

  -- --- Bitta adminda bitta faol sessiya ----------------------------
  --  Ikkita ochiq sessiya bo'lsa, hook `order by started_at desc`
  --  bilan oxirgisini oladi va admin qaysi maktabda ishlayotganini
  --  bilmay qoladi. Eskisi jimgina yopiladi va jurnalga tushadi.
  update public.impersonation_sessions
     set ended_at = now()
   where admin_id = v_admin and ended_at is null;
  get diagnostics v_closed = row_count;

  if v_closed > 0 then
    insert into public.impersonation_log
      (admin_id, school_id, mode, action, detail)
    values
      (v_admin, p_school_id, p_mode, 'auto_closed_previous',
       jsonb_build_object('count', v_closed));
  end if;

  v_expires := now() + (p_minutes * interval '1 minute');

  insert into public.impersonation_sessions
    (admin_id, school_id, target_user_id, mode, reason, expires_at)
  values
    (v_admin, p_school_id, p_target_user_id, p_mode, btrim(p_reason), v_expires)
  returning id into v_id;

  -- --- Ikkita jurnal (TZ 2.5 §2) ------------------------------------
  insert into public.impersonation_log
    (session_id, admin_id, school_id, target_user_id, mode, action, detail)
  values
    (v_id, v_admin, p_school_id, p_target_user_id, p_mode, 'session_started',
     jsonb_build_object('reason', btrim(p_reason),
                        'minutes', p_minutes,
                        'target_name', v_target.full_name,
                        'target_role', v_target.role));

  perform app.plog('impersonation_started', 'impersonation_sessions',
                   v_id::text, p_school_id, null,
                   jsonb_build_object('mode', p_mode,
                                      'reason', btrim(p_reason),
                                      'target_user_id', p_target_user_id,
                                      'expires_at', v_expires));

  return jsonb_build_object(
    'session_id',     v_id,
    'school_id',      p_school_id,
    'target_user_id', p_target_user_id,
    'target_name',    v_target.full_name,
    'mode',           p_mode,
    'expires_at',     v_expires,
    'closed_previous', v_closed);
end;
$$;

comment on function public.start_impersonation(uuid, uuid, public.impersonation_mode, text, int) is
  'TZ M1 — texnik yordam sessiyasini ochadi. Sabab majburiy (10+ '
  'belgi), muddat 5–120 daqiqa, bitta adminda bitta faol sessiya. '
  'Ikkita jurnalga yoziladi.';

revoke all on function public.start_impersonation(uuid, uuid, public.impersonation_mode, text, int)
  from public, anon;
grant execute on function public.start_impersonation(uuid, uuid, public.impersonation_mode, text, int)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. SESSIYANI YOPISH (TZ M1)
--
--  Ochgan admin ham, boshqa super admin ham yopa oladi — birinchisi
--  brauzerni yopib ketgan bo'lsa sessiya osilib qolmasin.
-- ---------------------------------------------------------------------

create or replace function public.end_impersonation(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := app.require_platform_admin();
  v_s     public.impersonation_sessions%rowtype;
begin
  select * into v_s from public.impersonation_sessions where id = p_session_id;
  if not found then
    raise exception 'Sessiya topilmadi' using errcode = 'P0002';
  end if;

  if v_s.ended_at is not null then
    return jsonb_build_object('session_id', p_session_id, 'changed', false,
                              'ended_at', v_s.ended_at);
  end if;

  update public.impersonation_sessions
     set ended_at = now()
   where id = p_session_id;

  insert into public.impersonation_log
    (session_id, admin_id, school_id, target_user_id, mode, action, detail)
  values
    (p_session_id, v_s.admin_id, v_s.school_id, v_s.target_user_id, v_s.mode,
     'session_ended',
     jsonb_build_object('ended_by', v_admin,
                        'by_other_admin', v_admin <> v_s.admin_id));

  perform app.plog('impersonation_ended', 'impersonation_sessions',
                   p_session_id::text, v_s.school_id,
                   jsonb_build_object('ended_at', null),
                   jsonb_build_object('ended_at', now(), 'ended_by', v_admin));

  return jsonb_build_object('session_id', p_session_id, 'changed', true);
end;
$$;

revoke all on function public.end_impersonation(uuid) from public, anon;
grant execute on function public.end_impersonation(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. MAKTAB FOYDALANUVCHILARI RO'YXATI
--
--  Sessiya ochish oynasi uchun. `app_users` ni super admin RLS
--  orqali ham ko'ra oladi, lekin unda `auth.users` dagi email yo'q
--  va oxirgi kirish sanasi ham yo'q. Bu funksiya kerakli ustunlarni
--  bitta joyda yig'adi.
-- ---------------------------------------------------------------------

create or replace function public.school_users(p_school_id uuid)
returns table (
  id            uuid,
  full_name     text,
  role          public.user_role,
  email         text,
  phone         text,
  is_active     boolean,
  last_sign_in  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.full_name, u.role, u.email::text, u.phone, u.is_active,
         au.last_sign_in_at
    from public.app_users u
    left join auth.users au on au.id = u.id
   where u.school_id = p_school_id
     and u.deleted_at is null
     and app.is_platform_admin()
   order by u.is_active desc, u.full_name;
$$;

comment on function public.school_users(uuid) is
  'Maktab xodimlari — texnik yordam sessiyasini ochish oynasi uchun. '
  'Huquq tekshiruvi `where` ichida: admin bo''lmasa bo''sh natija.';

revoke all on function public.school_users(uuid) from public, anon;
grant execute on function public.school_users(uuid) to authenticated, service_role;

-- =====================================================================
--  YOZISHMA
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4. YANGI MAVZU
--
--  Maktab o'zi uchun ochadi (p_school_id e'tiborga olinmaydi),
--  super admin esa istalgan maktab uchun.
-- ---------------------------------------------------------------------

create or replace function public.open_support_thread(
  p_subject   text,
  p_body      text,
  p_school_id uuid default null,
  p_priority  public.support_priority default 'normal',
  p_file_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_platform boolean := app.is_platform_admin();
  v_user     uuid := (select auth.uid());
  v_school   uuid;
  v_id       uuid;
begin
  if length(btrim(coalesce(p_subject, ''))) < 3 then
    raise exception 'Mavzu kamida 3 belgi bo''lishi kerak' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_body, ''))) < 1 then
    raise exception 'Xabar bo''sh bo''lishi mumkin emas' using errcode = '22023';
  end if;

  if v_platform then
    if p_school_id is null then
      raise exception 'Maktab tanlanishi kerak' using errcode = '22023';
    end if;
    v_school := p_school_id;
  else
    v_school := app.school_id();
    if v_school is null then
      raise exception 'Maktab konteksti topilmadi' using errcode = '42501';
    end if;
    -- Texnik yordam sessiyasidagi o'qish rejimi yozmaydi.
    if app.is_readonly_session() then
      raise exception 'Faqat o''qish rejimida yozib bo''lmaydi'
        using errcode = '42501';
    end if;
  end if;

  insert into public.support_threads
    (school_id, subject, priority, opened_by, opened_by_platform)
  values
    (v_school, btrim(p_subject), p_priority, v_user, v_platform)
  returning id into v_id;

  perform app.support_post(v_id, v_school, v_user, v_platform,
                           p_body, p_file_path, false);

  if v_platform then
    perform app.plog('support_thread_opened', 'support_threads',
                     v_id::text, v_school, null,
                     jsonb_build_object('subject', btrim(p_subject)));
  end if;

  return jsonb_build_object('thread_id', v_id, 'school_id', v_school);
end;
$$;

revoke all on function public.open_support_thread(text, text, uuid, public.support_priority, text)
  from public, anon;
grant execute on function public.open_support_thread(text, text, uuid, public.support_priority, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. XABAR YOZISH
--
--  Bloklangan maktab ham yoza oladi — bu ataylab (migratsiya 41 ga
--  qarang): to'lov muammosini muhokama qiladigan joy kerak.
-- ---------------------------------------------------------------------

create or replace function public.post_support_message(
  p_thread_id uuid,
  p_body      text,
  p_file_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_platform boolean := app.is_platform_admin();
  v_user     uuid := (select auth.uid());
  v_thread   public.support_threads%rowtype;
  v_id       bigint;
begin
  if length(btrim(coalesce(p_body, ''))) < 1 then
    raise exception 'Xabar bo''sh bo''lishi mumkin emas' using errcode = '22023';
  end if;

  select * into v_thread from public.support_threads where id = p_thread_id;
  if not found then
    raise exception 'Mavzu topilmadi' using errcode = 'P0002';
  end if;

  if not v_platform then
    if v_thread.school_id is distinct from app.school_id() then
      raise exception 'Bu yozishmaga kirish huquqi yo''q' using errcode = '42501';
    end if;
    if app.is_readonly_session() then
      raise exception 'Faqat o''qish rejimida yozib bo''lmaydi'
        using errcode = '42501';
    end if;
  end if;

  v_id := app.support_post(p_thread_id, v_thread.school_id, v_user,
                           v_platform, p_body, p_file_path, false);

  return jsonb_build_object('message_id', v_id, 'thread_id', p_thread_id);
end;
$$;

revoke all on function public.post_support_message(uuid, text, text) from public, anon;
grant execute on function public.post_support_message(uuid, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. MAVZUNI YOPISH / QAYTA OCHISH
-- ---------------------------------------------------------------------

create or replace function public.set_support_thread_status(
  p_thread_id uuid,
  p_status    public.support_thread_status
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_platform boolean := app.is_platform_admin();
  v_thread   public.support_threads%rowtype;
begin
  select * into v_thread from public.support_threads where id = p_thread_id;
  if not found then
    raise exception 'Mavzu topilmadi' using errcode = 'P0002';
  end if;

  if not v_platform and v_thread.school_id is distinct from app.school_id() then
    raise exception 'Bu yozishmaga kirish huquqi yo''q' using errcode = '42501';
  end if;

  update public.support_threads
     set status    = p_status,
         closed_at = case when p_status = 'closed' then now() else null end
   where id = p_thread_id;

  return jsonb_build_object('thread_id', p_thread_id, 'status', p_status);
end;
$$;

revoke all on function public.set_support_thread_status(uuid, public.support_thread_status)
  from public, anon;
grant execute on function public.set_support_thread_status(uuid, public.support_thread_status)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. O'QILDI BELGISI
--
--  Har bir xabar uchun alohida yozuv emas, bitta sana. "Yangi xabar
--  bormi" degan savolga javob berish uchun shu yetarli.
-- ---------------------------------------------------------------------

create or replace function public.mark_support_read(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_platform boolean := app.is_platform_admin();
  v_thread   public.support_threads%rowtype;
begin
  select * into v_thread from public.support_threads where id = p_thread_id;
  if not found then
    raise exception 'Mavzu topilmadi' using errcode = 'P0002';
  end if;

  if v_platform then
    update public.support_threads set platform_read_at = now() where id = p_thread_id;
  else
    if v_thread.school_id is distinct from app.school_id() then
      raise exception 'Bu yozishmaga kirish huquqi yo''q' using errcode = '42501';
    end if;
    update public.support_threads set school_read_at = now() where id = p_thread_id;
  end if;

  return jsonb_build_object('thread_id', p_thread_id, 'read_at', now());
end;
$$;

revoke all on function public.mark_support_read(uuid) from public, anon;
grant execute on function public.mark_support_read(uuid) to authenticated, service_role;
