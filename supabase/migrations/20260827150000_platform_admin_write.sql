-- =====================================================================
--  52 — SUPER ADMIN MAKTAB MA'LUMOTINI TAHRIRLAY OLADI
--
--  NOMLASH: bu repo migratsiyalari HAR DOIM `15` vaqt uyasini
--  ishlatadi (`YYYYMMDD` + `15` + `MMSS`), asosiy repo esa
--  `12`–`14` ni. Sabab amaliy: ikkala repo BITTA tarix jadvaliga
--  yozadi va bir xil versiya raqami jimgina o'tkazib yuboriladi —
--  `db.mjs` uni "allaqachon qo'llangan" deb ko'radi va migratsiya
--  BAJARILMAY qoladi, xato ham bermaydi.
--
--  Bu aynan shu faylda sodir bo'ldi: dastlab `20260827120000` deb
--  nomlangan edi, asosiy repo esa o'sha kuni o'sha raqamni
--  `attendance_overview` uchun band qilgan.
--
--  TALAB (loyiha egasi, 2026-08-27): "hohlagan maktabimning
--  ma'lumotlarini tahrirlay olay".
--
--  HOZIRGI HOLAT. Super admin HECH NARSANI o'zgartira olmasdi. Barcha
--  yozish siyosatlari `school_id = app.school_id()` ni talab qiladi,
--  platforma adminida esa `app.school_id()` NULL — u hech qaysi
--  maktabga tegishli emas. Hatto maktab nomidagi xatoni ham
--  tuzatib bo'lmasdi.
--
--  YECHIM. 29 ta jadvalning yozish siyosatiga `or is_platform_admin()`
--  qo'shiladi. Bu — o'quvchilar, sinflar, o'qituvchilar, xizmatlar,
--  xarajatlar, filiallar, xodimlar va maktab yozuvining o'zi.
--
--  NIMA O'ZGARMAYDI — VA NEGA. Oltita moliyaviy jadval
--  (`payments`, `invoices`, `invoice_lines`, `cash_receipts`,
--  `payroll_runs`, `payroll_lines`) tegilmaydi. Ularda yozish
--  siyosati UMUMAN yo'q va `app.security_invariants()` ning
--  4-invarianti aynan shuni tekshiradi:
--
--      'INVARIANT 4 BUZILDI — moliyaviy jadvalga yozish siyosati
--       paydo bo''lgan'
--
--  Siyosat qo'shilsa invariant XATO TASHLAYDI va ikkala repodagi
--  butun sinov zanjiri yiqiladi. Pulga tegadigan yozuvlar faqat
--  `SECURITY DEFINER` funksiyalar orqali kiradi — bu TZ 5.4.6 va
--  loyihaning eng qattiq qoidasi. Uni bu migratsiya buzmaydi.
--
--  DIQQAT — SHAFFOFLIK SAQLANADI. To'g'ridan-to'g'ri yozish
--  jurnalsiz qolib ketmasligi kerak edi: `audit_log` ni maktab
--  direktori o'z panelida ko'radi (TZ 4.13.5.2), va u yerda
--  tanish bo'lmagan `user_id` paydo bo'lardi — direktor kim
--  o'zgartirganini tushunmasdi.
--
--  Shuning uchun audit triggeri ham o'zgartiriladi: platforma
--  admini qilgan har bir o'zgarish `impersonated_by` bilan
--  belgilanadi — xuddi texnik yordam sessiyasidagidek. Direktor
--  panelida u "platforma o'zgartirdi" bo'lib ko'rinadi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. YOZISH SIYOSATLARIGA PLATFORMA ADMINI QO'SHILADI
--
--  Siyosatlar QO'LDA ko'chirilmaydi: 29 ta jadval, har birida ikkitadan
--  siyosat va ularning ifodasi har xil. Migratsiya 36, 41 va 48 dagi
--  naqsh takrorlanadi — mavjud ifoda o'qiladi, kengaytiriladi,
--  siyosat qaytadan yaratiladi.
-- ---------------------------------------------------------------------

do $do$
declare
  r        record;
  v_qual   text;
  v_check  text;
  v_cmd    text;
  v_kind   text;
  v_n      int := 0;
  --  Invariant 4 himoyalaydigan jadvallar. Bu ro'yxat `security_invariants`
  --  dagi bilan AYNAN bir xil bo'lishi shart.
  v_money  text[] := array['payments', 'invoices', 'invoice_lines',
                           'cash_receipts', 'payroll_runs', 'payroll_lines'];
begin
  for r in
    select
      c.relname                               as tbl,
      p.polname                               as pol,
      p.polcmd                                as cmd,
      p.polpermissive                         as permissive,
      pg_get_expr(p.polqual, p.polrelid)      as qual,
      pg_get_expr(p.polwithcheck, p.polrelid) as chk,
      coalesce(
        (select string_agg(quote_ident(rolname), ', ')
           from pg_roles where oid = any (p.polroles)),
        'public')                             as roles
    from pg_policy p
    join pg_class c     on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and p.polcmd in ('a', 'w')            -- INSERT, UPDATE
     and not (c.relname = any (v_money))
   order by c.relname, p.polname
  loop
    -- Migratsiya qayta ishga tushsa ikki marta qo'shilmasin.
    continue when coalesce(r.qual, '') || coalesce(r.chk, '')
                  like '%is_platform_admin%';

    v_qual  := r.qual;
    v_check := r.chk;

    if v_qual is not null then
      v_qual := '(' || v_qual || ') or (select app.is_platform_admin())';
    end if;
    if v_check is not null then
      v_check := '(' || v_check || ') or (select app.is_platform_admin())';
    end if;

    v_cmd  := case r.cmd when 'a' then 'insert' else 'update' end;
    v_kind := case when r.permissive then 'permissive' else 'restrictive' end;

    execute format('drop policy %I on public.%I', r.pol, r.tbl);

    --  `with check` uchun `format` ISHLATILMAYDI — u null ni bo'sh
    --  satrga aylantiradi va `with check ()` degan buzuq SQL chiqadi.
    execute
      format('create policy %I on public.%I as %s for %s to %s',
             r.pol, r.tbl, v_kind, v_cmd, r.roles)
      || coalesce(' using (' || v_qual || ')', '')
      || coalesce(' with check (' || v_check || ')', '');

    v_n := v_n + 1;
  end loop;

  raise notice 'Platforma admini % ta yozish siyosatiga qo''shildi', v_n;
end $do$;

-- ---------------------------------------------------------------------
-- 2. AUDIT TRIGGERI PLATFORMA AMALINI BELGILAYDI
--
--  Ilgari `impersonated_by` faqat texnik yordam sessiyasida
--  to'ldirilardi (JWT dagi `imp_admin` claim'idan). Endi platforma
--  admini TO'G'RIDAN-TO'G'RI yozganda ham to'ldiriladi — aks holda
--  direktor o'z jurnalida notanish `user_id` ko'radi va kim
--  o'zgartirganini bilmaydi.
--
--  Boshqa hech narsa o'zgarmaydi: mantiq, ustunlar, chaqiruv joyi.
-- ---------------------------------------------------------------------

create or replace function app.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before  jsonb;
  v_after   jsonb;
  v_school  uuid;
  v_id      text;
  v_keys    text[];
  v_by      uuid;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);
    -- updated_at har doim o'zgaradi — uni farqdan chiqaramiz.
    select array_agg(k) into v_keys
      from jsonb_object_keys(v_after) k
     where k <> 'updated_at'
       and (v_after -> k) is distinct from (v_before -> k);

    -- Mazmunli o'zgarish yo'q — jurnalni shovqin bilan to'ldirmaymiz.
    if v_keys is null then
      return new;
    end if;
  else
    v_before := to_jsonb(old);
  end if;

  v_school := coalesce(
    (v_after  ->> 'school_id')::uuid,
    (v_before ->> 'school_id')::uuid);
  v_id := coalesce(v_after ->> 'id', v_before ->> 'id');

  --  Kim: avval texnik yordam sessiyasi claim'i, keyin — to'g'ridan
  --  yozayotgan platforma admini. Ikkalasi ham direktorga "platforma
  --  o'zgartirdi" bo'lib ko'rinadi, va aynan shu kerak.
  v_by := nullif(app.jwt_claim('imp_admin'), '')::uuid;
  if v_by is null and app.is_platform_admin() then
    v_by := (select auth.uid());
  end if;

  if v_school is not null then
    insert into public.audit_log
      (school_id, user_id, table_name, record_id, action,
       before, after, changed_keys, impersonated_by)
    values
      (v_school, (select auth.uid()), tg_table_name, v_id, tg_op,
       v_before, v_after, v_keys, v_by);
  end if;

  return coalesce(new, old);
end;
$$;

comment on function app.audit_trigger() is
  'TZ 5.4.10 — universal audit triggeri. `impersonated_by` ikki holda '
  'to''ldiriladi: texnik yordam sessiyasida (JWT claim) va platforma '
  'admini to''g''ridan-to''g''ri yozganda. Direktor ikkalasini ham '
  'o''z jurnalida ko''radi (TZ 4.13.5.2).';

-- ---------------------------------------------------------------------
-- 3. MAKTAB YOZUVINI TAHRIRLASH — RPC
--
--  `schools` ga endi to'g'ridan-to'g'ri UPDATE ham mumkin, lekin
--  panel RPC orqali ishlaydi. Sabab: har bir o'zgarish `platform_log`
--  ga oldingi va yangi qiymat bilan tushsin. To'g'ridan-to'g'ri
--  UPDATE faqat `audit_log` ga tushardi, platforma jurnaliga emas —
--  va operator "men nima o'zgartirgan edim" degan savolga javob
--  topolmasdi.
--
--  `status` bu yerda O'ZGARTIRILMAYDI: uning o'z funksiyasi bor
--  (`set_school_status`) va u sababni majburiy qiladi.
-- ---------------------------------------------------------------------

create or replace function public.update_school_profile(
  p_school_id    uuid,
  p_name         text default null,
  p_legal_name   text default null,
  p_tax_id       text default null,
  p_address      text default null,
  p_phone        text default null,
  p_email        text default null,
  p_timezone     text default null,
  p_default_lang text default null,
  p_closing_day  smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := app.require_platform_admin();
  v_old   public.schools%rowtype;
begin
  select * into v_old from public.schools where id = p_school_id;
  if not found then
    raise exception 'Maktab topilmadi' using errcode = 'P0002';
  end if;

  if p_name is not null and length(btrim(p_name)) < 2 then
    raise exception 'Maktab nomi juda qisqa' using errcode = '22023';
  end if;
  if p_default_lang is not null
     and p_default_lang not in ('uz', 'uz-cyrl', 'ru') then
    raise exception 'Til uz, uz-cyrl yoki ru bo''lishi kerak'
      using errcode = '22023';
  end if;
  if p_closing_day is not null and p_closing_day not between 1 and 28 then
    raise exception 'Oy yopish sanasi 1 dan 28 gacha bo''lishi kerak'
      using errcode = '22023';
  end if;

  --  `coalesce` — berilmagan maydon TEGILMAYDI. Panel faqat
  --  o'zgargan maydonlarni yuborishi shart emas; bu yerda
  --  yuborilmagani eskisi bo'lib qoladi.
  update public.schools
     set name         = coalesce(btrim(p_name), name),
         legal_name   = coalesce(btrim(p_legal_name), legal_name),
         tax_id       = coalesce(btrim(p_tax_id), tax_id),
         address      = coalesce(btrim(p_address), address),
         phone        = coalesce(btrim(p_phone), phone),
         email        = coalesce(btrim(p_email), email::text)::extensions.citext,
         timezone     = coalesce(p_timezone, timezone),
         default_lang = coalesce(p_default_lang, default_lang),
         closing_day  = coalesce(p_closing_day, closing_day)
   where id = p_school_id;

  perform app.plog('school_profile_updated', 'schools',
                   p_school_id::text, p_school_id,
                   jsonb_build_object('name', v_old.name,
                                      'legal_name', v_old.legal_name,
                                      'tax_id', v_old.tax_id,
                                      'address', v_old.address,
                                      'phone', v_old.phone,
                                      'email', v_old.email,
                                      'timezone', v_old.timezone,
                                      'default_lang', v_old.default_lang,
                                      'closing_day', v_old.closing_day),
                   (select jsonb_build_object('name', name,
                                              'legal_name', legal_name,
                                              'tax_id', tax_id,
                                              'address', address,
                                              'phone', phone,
                                              'email', email,
                                              'timezone', timezone,
                                              'default_lang', default_lang,
                                              'closing_day', closing_day,
                                              'admin_id', v_admin)
                      from public.schools where id = p_school_id));

  return jsonb_build_object('school_id', p_school_id, 'updated', true);
end;
$$;

revoke all on function public.update_school_profile(
  uuid, text, text, text, text, text, text, text, text, smallint)
  from public, anon;
grant execute on function public.update_school_profile(
  uuid, text, text, text, text, text, text, text, text, smallint)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. TEKSHIRUV
-- ---------------------------------------------------------------------

do $do$
declare r record; v_n int := 0; v_money int;
begin
  -- --- 4a. Invariantlar butunmi (eng muhimi) ----------------------
  for r in select * from app.security_invariants() loop
    v_n := v_n + 1;
  end loop;
  if v_n <> 10 then
    raise exception 'Invariant soni: % (10 kutilgan)', v_n;
  end if;
  raise notice 'Tekshiruv: o''nta invariant butun';

  -- --- 4b. Moliyaviy jadvallarga siyosat qo'shilmadimi -------------
  select count(*) into v_money
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('payments','invoices','invoice_lines',
                       'cash_receipts','payroll_runs','payroll_lines')
     and p.polcmd in ('a','w');
  if v_money > 0 then
    raise exception 'Moliyaviy jadvalga yozish siyosati qo''shilib qolgan (% ta)', v_money;
  end if;
  raise notice 'Tekshiruv: moliyaviy jadvallar hamon yopiq';

  -- --- 4c. Chaqiruvlar (select ...) ichidami -----------------------
  declare v_bad text; v_c int;
  begin
    select string_agg(c.relname || '.' || p.polname, ', '), count(*)
      into v_bad, v_c
      from pg_policy p
      join pg_class c     on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace,
      lateral (select coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' '
                   || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as e) x
     where n.nspname = 'public'
       and regexp_count(x.e, 'app\.[a-z_]+\(') >
           regexp_count(x.e, 'SELECT\s+app\.[a-z_]+\(');
    if v_c > 0 then
      raise exception 'O''ralmagan chaqiruv (% ta): %', v_c, v_bad;
    end if;
    raise notice 'Tekshiruv: barcha chaqiruv (select ...) ichida';
  end;
end $do$;
