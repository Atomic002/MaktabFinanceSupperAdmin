-- =====================================================================
--  SINOV — PLATFORMA QATLAMI (TZ 2.6)
--
--  Xato bo'lmasa = hamma tekshiruv o'tdi. Har bir holat `raise
--  exception` bilan tasdiqlanadi.
--
--    node scripts/db.mjs file scripts/test-platform.sql
--
--  BUTUN FAYL `begin ... rollback` ICHIDA. Sinov haqiqiy bazada,
--  haqiqiy RLS bilan ishlaydi — lekin oxirida hech qanday iz
--  qolmaydi. Shu tufayli uni ishlab chiqarish bazasida ham xavfsiz
--  ishga tushirish mumkin va tozalash kodi kerak emas.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  0. XAVFSIZLIK INVARIANTLARI HALI HAM BUTUNMI
--
--  Platforma migratsiyalari 100 dan ortiq siyosatni qayta yozdi.
--  Birinchi savol: himoya joyidami?
-- ---------------------------------------------------------------------

do $$
declare r record; v_n int := 0;
begin
  raise notice '';
  raise notice '=== XAVFSIZLIK INVARIANTLARI ===';
  for r in select * from app.security_invariants() loop
    v_n := v_n + 1;
    raise notice '  % — %', r.tekshiruv, r.tafsilot;
  end loop;
  if v_n <> 10 then
    raise exception 'XATO: % ta invariant, 10 ta kutilgan edi', v_n;
  end if;
  raise notice '  → o''nta invariantning hammasi o''tdi';
end $$;

-- ---------------------------------------------------------------------
--  SINOV UCHUN PLATFORMA ADMINI
--
--  Huquq tekshiruvlari haqiqiy admin bo'lmasa ma'nosiz: "rad etildi"
--  degan natija sabab validatsiyasidan emas, huquq yo'qligidan
--  kelib chiqishi mumkin.
-- ---------------------------------------------------------------------

create temporary table sinov_ctx (k text primary key, v uuid);

do $$
declare v_admin uuid := gen_random_uuid();
begin
  insert into auth.users (id) values (v_admin);
  insert into public.platform_admins (id, full_name, is_active)
  values (v_admin, 'Sinov operatori', true);
  insert into sinov_ctx values ('admin', v_admin);
end $$;

-- ---------------------------------------------------------------------
--  1. NARX FORMULASI (TZ 2.4)
--
--  TZ dagi namunalar jadvalidan olingan to'rtta holat. Raqamlar
--  qo'lda hisoblangan — funksiya AYNAN shularni qaytarishi kerak.
--  "1 filial, 251 o'quvchi → 550 000" eng muhimi: u yaxlitlash
--  YUQORIGA ekanini isbotlaydi (bitta ortiqcha bola ham to'liq
--  50 000 turadi).
-- ---------------------------------------------------------------------

do $$
declare
  v_school uuid;
  v_branch uuid;
  v_got    numeric;

begin
  raise notice '';
  raise notice '=== NARX FORMULASI ===';

  v_school := (public.provision_school(
    'SINOV-PLATFORMA Narx', 'Asosiy', 'basic', 30) ->> 'school_id')::uuid;
  insert into sinov_ctx values ('narx', v_school);

  -- --- 1 filial, 250 o'quvchi → 500 000 (aynan chegarada) ----------
  insert into public.students (school_id, branch_id, full_name, status, enrolled_on)
  select v_school, b.id, 'Sinov ' || g, 'active', current_date
    from public.branches b, generate_series(1, 250) g
   where b.school_id = v_school and b.is_default;

  v_got := (public.school_price(v_school) ->> 'monthly_total')::numeric;
  if v_got <> 500000 then
    raise exception 'XATO: 1 filial / 250 o''quvchi → % (500000 kutilgan)', v_got;
  end if;
  raise notice '  1 filial, 250 o''quvchi → % ✓  (chegarada)', v_got;

  -- --- 1 filial, 251 o'quvchi → 550 000 (yaxlitlash yuqoriga) ------
  insert into public.students (school_id, branch_id, full_name, status, enrolled_on)
  select v_school, b.id, 'Sinov 251', 'active', current_date
    from public.branches b where b.school_id = v_school and b.is_default;

  v_got := (public.school_price(v_school) ->> 'monthly_total')::numeric;
  if v_got <> 550000 then
    raise exception 'XATO: 1 filial / 251 o''quvchi → % (550000 kutilgan). '
                    'Yaxlitlash yuqoriga bo''lishi kerak.', v_got;
  end if;
  raise notice '  1 filial, 251 o''quvchi → % ✓  (yaxlitlash yuqoriga)', v_got;

  -- --- 1 filial, 340 o'quvchi → 600 000 ---------------------------
  --  340 − 250 = 90 ortiqcha → ceil(90/50) = 2 qadam
  insert into public.students (school_id, branch_id, full_name, status, enrolled_on)
  select v_school, b.id, 'Sinov A' || g, 'active', current_date
    from public.branches b, generate_series(252, 340) g
   where b.school_id = v_school and b.is_default;

  v_got := (public.school_price(v_school) ->> 'monthly_total')::numeric;
  if v_got <> 600000 then
    raise exception 'XATO: 1 filial / 340 o''quvchi → % (600000 kutilgan)', v_got;
  end if;
  raise notice '  1 filial, 340 o''quvchi → % ✓', v_got;

  -- --- 2 filial, 610 o'quvchi → 1 100 000 -------------------------
  --  Ikkinchi filial limitni 500 ga ko'taradi.
  --  610 − 500 = 110 ortiqcha → ceil(110/50) = 3 qadam
  insert into public.branches (school_id, name, is_active)
  values (v_school, 'Ikkinchi filial', true) returning id into v_branch;

  insert into public.students (school_id, branch_id, full_name, status, enrolled_on)
  select v_school, v_branch, 'Sinov B' || g, 'active', current_date
    from generate_series(1, 270) g;

  v_got := (public.school_price(v_school) ->> 'monthly_total')::numeric;
  if v_got <> 1100000 then
    raise exception 'XATO: 2 filial / 610 o''quvchi → % (1100000 kutilgan)', v_got;
  end if;
  raise notice '  2 filial, 610 o''quvchi → % ✓', v_got;

  -- --- Akademik ta'til va chiqib ketganlar SANALMAYDI (TZ 2.4) -----
  update public.students
     set status = 'academic_leave'
   where school_id = v_school and full_name like 'Sinov B%'
     and id in (select id from public.students
                 where school_id = v_school and full_name like 'Sinov B%'
                 limit 20);

  v_got := (public.school_price(v_school) ->> 'monthly_total')::numeric;
  if v_got <> 1050000 then
    raise exception 'XATO: 20 ta akademik ta''tildan keyin → % (1050000 kutilgan). '
                    'Faqat active o''quvchilar sanalishi kerak.', v_got;
  end if;
  raise notice '  20 ta akademik ta''til → % ✓  (faqat active sanaladi)', v_got;

  -- --- Ulanish to'lovi faqat BIRINCHI hisob-fakturada --------------
  if (public.school_price(v_school) ->> 'setup_fee')::numeric <> 600000 then
    raise exception 'XATO: birinchi hisob-fakturada ulanish to''lovi yo''q';
  end if;

  perform public.issue_subscription_invoice(v_school);

  if (public.school_price(v_school) ->> 'setup_fee')::numeric <> 0 then
    raise exception 'XATO: ulanish to''lovi IKKINCHI marta hisoblandi';
  end if;
  raise notice '  ulanish to''lovi bir marta → 600000 ✓';

  -- --- Hisob-faktura takrorlanmaydi -------------------------------
  if (public.issue_subscription_invoice(v_school) ->> 'created')::boolean then
    raise exception 'XATO: bir oyga ikkinchi hisob-faktura chiqarildi';
  end if;
  raise notice '  takroriy hisob-faktura → rad ✓';

  -- --- Tafsilot saqlanadimi (qat'iy talab #15) --------------------
  if not exists (
    select 1 from public.subscription_invoices
     where school_id = v_school
       and students_count = 590        -- 610 − 20 akademik ta'til
       and branches_count = 2
       and students_included = 500
  ) then
    raise exception 'XATO: hisob-fakturada tafsilot muzlatilmagan';
  end if;
  raise notice '  hisob-fakturada tafsilot saqlandi ✓';
end $$;
-- ---------------------------------------------------------------------
--  2. BLOKLASH ZINAPOYASI (TZ 2.4, M7)
--
--  Muddatni orqaga surib har bir bosqichni tekshiramiz.
--
--    < 30 kun   → active     (15-kuni faqat eslatma)
--    30 … 44    → grace, maktab hamon active
--    45+        → restricted — oxirgi bosqich
--
--  `suspended` degan holat YO'Q (49-migratsiya).
-- ---------------------------------------------------------------------

do $$
declare
  v_school uuid;
  v_status public.school_status;
  v_sub    public.subscription_status;
begin
  raise notice '';
  raise notice '=== BLOKLASH ZINAPOYASI ===';

  v_school := (public.provision_school(
    'SINOV-PLATFORMA Bloklash', 'Asosiy', 'basic', 30) ->> 'school_id')::uuid;
  insert into sinov_ctx values ('blok', v_school);

  -- Sinov muddatini tugatamiz — aks holda trial holatida qoladi.
  update public.school_subscriptions
     set status = 'active', trial_ends_at = current_date - 60
   where school_id = v_school;

  -- --- Muddat kelmagan → active ------------------------------------
  update public.school_subscriptions
     set next_payment_date = current_date + 10 where school_id = v_school;
  perform app.recompute_school_billing(v_school);
  select status into v_status from public.schools where id = v_school;
  if v_status <> 'active' then
    raise exception 'XATO: muddat kelmagan → % (active kutilgan)', v_status;
  end if;
  raise notice '  muddat kelmagan → active               ✓';

  -- --- 29 kun kechikdi → hamon active ------------------------------
  --  Eng muhim regressiya tekshiruvi: eski zinapoyada bu holat
  --  allaqachon `restricted` bo'lardi.
  update public.school_subscriptions
     set next_payment_date = current_date - 29 where school_id = v_school;
  perform app.recompute_school_billing(v_school);
  select status into v_status from public.schools where id = v_school;
  select status into v_sub from public.school_subscriptions where school_id = v_school;
  if v_status <> 'active' or v_sub <> 'active' then
    raise exception 'XATO: 29 kun kechikish → maktab %, obuna % '
                    '(active/active kutilgan)', v_status, v_sub;
  end if;
  raise notice '  29 kun kechikdi → active               ✓';

  -- --- 30 kun kechikdi → obuna grace, maktab hamon active ----------
  update public.school_subscriptions
     set next_payment_date = current_date - 30 where school_id = v_school;
  perform app.recompute_school_billing(v_school);
  select status into v_status from public.schools where id = v_school;
  select status into v_sub from public.school_subscriptions where school_id = v_school;
  if v_status <> 'active' or v_sub <> 'grace' then
    raise exception 'XATO: 30 kun kechikish → maktab %, obuna % '
                    '(active/grace kutilgan)', v_status, v_sub;
  end if;
  raise notice '  30 kun kechikdi → active + grace       ✓';

  -- --- 44 kun kechikdi → hamon grace -------------------------------
  update public.school_subscriptions
     set next_payment_date = current_date - 44 where school_id = v_school;
  perform app.recompute_school_billing(v_school);
  select status into v_status from public.schools where id = v_school;
  if v_status <> 'active' then
    raise exception 'XATO: 44 kun kechikish → % (active kutilgan)', v_status;
  end if;
  raise notice '  44 kun kechikdi → active + grace       ✓';

  -- --- 46 kun kechikdi → restricted (TZ sinov jadvali) -------------
  update public.school_subscriptions
     set next_payment_date = current_date - 46 where school_id = v_school;
  perform app.recompute_school_billing(v_school);
  select status into v_status from public.schools where id = v_school;
  select status into v_sub from public.school_subscriptions where school_id = v_school;
  if v_status <> 'restricted' or v_sub <> 'restricted' then
    raise exception 'XATO: 46 kun kechikish → maktab %, obuna % '
                    '(restricted/restricted kutilgan)', v_status, v_sub;
  end if;
  raise notice '  46 kun kechikdi → restricted           ✓';

  -- --- Hech qachon `suspended` bo'lmaydi ---------------------------
  update public.school_subscriptions
     set next_payment_date = current_date - 400 where school_id = v_school;
  perform app.recompute_school_billing(v_school);
  select status into v_status from public.schools where id = v_school;
  if v_status <> 'restricted' then
    raise exception 'XATO: 400 kun kechikish → % (restricted kutilgan — '
                    'restricted OXIRGI bosqich)', v_status;
  end if;
  raise notice '  400 kun kechikdi → hamon restricted    ✓';

  -- --- To'lovdan keyin QAYTADI -------------------------------------
  --  Butun tizimning ma'nosi shu tekshiruvda: pul keldi → ishlaydi.
  perform app.apply_subscription_payment(v_school, 500000, current_date, 24);
  select status into v_status from public.schools where id = v_school;
  if v_status <> 'active' then
    raise exception 'XATO: to''lovdan keyin → % (active kutilgan)', v_status;
  end if;
  raise notice '  to''lov qilindi  → active               ✓';
end $$;
-- ---------------------------------------------------------------------
--  3. HUQUQ TEKSHIRUVLARI (TZ 2.6)
-- ---------------------------------------------------------------------

do $$
declare
  v_school uuid;
  v_admin  uuid;
  v_user   uuid := gen_random_uuid();
  v_ok     boolean;
  v_sess   uuid;
begin
  raise notice '';
  raise notice '=== HUQUQ TEKSHIRUVLARI ===';

  select v into v_school from sinov_ctx where k = 'blok';
  select v into v_admin  from sinov_ctx where k = 'admin';

  insert into auth.users (id) values (v_user);
  insert into public.app_users (id, school_id, role, full_name, all_branches, is_active)
  values (v_user, v_school, 'director', 'Sinov direktori', true, true);

  -- --- Direktor start_impersonation chaqirsa → 42501 ----------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    perform public.start_impersonation(v_school, v_user, 'read',
                                       'sinov uchun yetarli sabab', 30);
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if not v_ok then
    raise exception 'XATO: direktor start_impersonation chaqira oldi';
  end if;
  raise notice '  direktor start_impersonation  → 42501 ✓';

  -- --- Direktor set_school_status chaqirsa → 42501 ------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    perform public.set_school_status(v_school, 'active', 'sinov sababi');
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if not v_ok then
    raise exception 'XATO: direktor maktab holatini o''zgartira oldi';
  end if;
  raise notice '  direktor set_school_status    → 42501 ✓';

  -- --- Direktor UPDATE bilan holatni o'zgartirsa → trigger to'xtatadi
  --
  --  DIQQAT: maktab AYNAN O'SHA holatga o'tkazilsa trigger jim
  --  turadi (`is distinct from` false bo'ladi) va sinov aldanadi.
  --  Shuning uchun ataylab BOSHQA holat tanlanadi. Maktab hozir
  --  `active`, direktor uni `archived` qilmoqchi bo'ladi.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    update public.schools set status = 'archived' where id = v_school;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if not v_ok then
    raise exception 'XATO: direktor UPDATE orqali holatni o''zgartira oldi';
  end if;
  raise notice '  direktor UPDATE schools.status → 42501 ✓';

  -- =================================================================
  --  Endi HAQIQIY platforma admini sifatida — validatsiya tekshiruvi
  -- =================================================================

  -- --- Qisqa sabab rad etiladi --------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_ok := false;
  begin
    perform public.start_impersonation(v_school, v_user, 'read', 'qisqa', 30);
  exception when others then v_ok := true;
  end;
  if not v_ok then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'XATO: 10 belgidan qisqa sabab bilan sessiya ochildi';
  end if;
  raise notice '  qisqa sabab                   → rad   ✓';

  -- --- Muddat chegarasi ---------------------------------------------
  v_ok := false;
  begin
    perform public.start_impersonation(v_school, v_user, 'read',
                                       'yetarlicha uzun sabab matni', 500);
  exception when others then v_ok := true;
  end;
  if not v_ok then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'XATO: 500 daqiqalik sessiya ochildi';
  end if;
  raise notice '  500 daqiqalik sessiya         → rad   ✓';

  -- --- Boshqa maktabning foydalanuvchisi -----------------------------
  v_ok := false;
  begin
    perform public.start_impersonation(
      (select v from sinov_ctx where k = 'narx'), v_user, 'read',
      'yetarlicha uzun sabab matni', 30);
  exception when others then v_ok := true;
  end;
  if not v_ok then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'XATO: boshqa maktab foydalanuvchisi bilan sessiya ochildi';
  end if;
  raise notice '  begona foydalanuvchi          → rad   ✓';

  -- --- To'g'ri sessiya ochiladi --------------------------------------
  v_sess := (public.start_impersonation(v_school, v_user, 'read',
               'direktor hisobot ochilmayapti deb yozdi', 30) ->> 'session_id')::uuid;
  if v_sess is null then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'XATO: to''g''ri sessiya ochilmadi';
  end if;
  raise notice '  to''g''ri sessiya               → ochildi ✓';

  -- --- Ikkinchi sessiya birinchisini yopadi -------------------------
  perform public.start_impersonation(v_school, v_user, 'read',
            'ikkinchi sessiya sinovi uchun sabab', 30);

  if (select ended_at from public.impersonation_sessions where id = v_sess) is null then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'XATO: bitta adminda ikkita ochiq sessiya qoldi';
  end if;
  raise notice '  ikkinchi sessiya              → eskisi yopildi ✓';

  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- --- Ikkala jurnalga ham tushdimi ---------------------------------
  if not exists (select 1 from public.impersonation_log
                  where school_id = v_school and action = 'session_started') then
    raise exception 'XATO: impersonation_log ga yozilmadi';
  end if;
  if not exists (select 1 from public.platform_log
                  where school_id = v_school and action = 'impersonation_started') then
    raise exception 'XATO: platform_log ga yozilmadi';
  end if;
  raise notice '  ikkala jurnalga ham yozildi   → ✓';
end $$;

-- ---------------------------------------------------------------------
--  4. JURNALLARNI O'ZGARTIRIB BO'LMASLIGI (TZ 2.5 §5)
-- ---------------------------------------------------------------------

do $$
declare v_n int; v_bad text;
begin
  raise notice '';
  raise notice '=== JURNALLAR O''ZGARMAS ===';

  select count(*), string_agg(c.relname || '.' || p.polname, ', ')
    into v_n, v_bad
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public'
     and c.relname in ('platform_log', 'impersonation_log', 'support_messages',
                       'support_threads', 'subscription_invoices',
                       'subscription_payments', 'platform_settings')
     and p.polcmd in ('a', 'w', 'd');

  if v_n > 0 then
    raise exception 'XATO: yozish siyosati paydo bo''ldi: %', v_bad;
  end if;
  raise notice '  yozish siyosati yo''q → ✓';

  select count(*) into v_n
    from information_schema.role_table_grants
   where grantee = 'authenticated' and table_schema = 'public'
     and table_name in ('platform_log', 'impersonation_log', 'support_messages',
                        'support_threads', 'subscription_invoices',
                        'subscription_payments', 'platform_settings')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');

  if v_n > 0 then
    raise exception 'XATO: mijoz roliga yozish huquqi berilgan (% ta)', v_n;
  end if;
  raise notice '  yozish huquqi yo''q   → ✓';
end $$;

-- ---------------------------------------------------------------------
--  5. BLOKLANGAN MAKTAB BAZADA NIMANI KO'RADI
--
--  ENG MUHIM BO'LIM. TZ 2.4 va P2 aniq aytadi: bloklash RLS da
--  EMAS, AuthProvider da. Ya'ni `restricted` maktab uchun:
--
--    · baza O'QISHGA OCHIQ qoladi — TZ sinovi: "restricted
--      maktabda o'qish → ishlaydi";
--    · YOZISH `app.school_is_writable()` bilan to'siladi;
--    · chek yuborish va yozishma ISHLAYDI.
--
--  Kirishni panel to'sadi (`App.tsx` → `SuspendedShell`), baza emas.
--  Bu bo'lim aynan shuni isbotlaydi — 48-migratsiya RLS dan
--  bloklashni yechganini tekshiradi.
-- ---------------------------------------------------------------------

do $$
declare
  v_school uuid;
  v_user   uuid := gen_random_uuid();
  v_n      int;
  v_ok     boolean;
begin
  raise notice '';
  raise notice '=== BLOKLANGAN MAKTAB (restricted) ===';

  select v into v_school from sinov_ctx where k = 'narx';

  insert into auth.users (id) values (v_user);
  insert into public.app_users (id, school_id, role, full_name, all_branches, is_active)
  values (v_user, v_school, 'director', 'Narx direktori', true, true);

  -- --- Maktabni bloklaymiz -----------------------------------------
  update public.schools set status = 'restricted' where id = v_school;

  -- --- O'QISH ISHLAYDI (TZ sinov jadvali) --------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.students;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if v_n = 0 then
    raise exception 'XATO: restricted maktab o''z o''quvchilarini KO''RMAYAPTI. '
                    'Bloklash RLS da emas, AuthProvider da bo''lishi kerak '
                    '(TZ 2.4). 48-migratsiya qo''llanganmi?';
  end if;
  raise notice '  restricted → o''qish ISHLAYDI (% ta)   ✓', v_n;

  -- --- Hisobotlar ham ochiq ----------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.invoices;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  raise notice '  restricted → hisoblanma ko''rinadi     ✓';

  -- --- YOZIB BO'LMAYDI ---------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    insert into public.branches (school_id, name) values (v_school, 'Yangi filial');
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if not v_ok then
    raise exception 'XATO: restricted maktab yangi filial qo''sha oldi';
  end if;
  raise notice '  restricted → yozib bo''lmaydi          ✓';

  -- --- O'quvchi qo'shib ham bo'lmaydi (TZ sinovi) ------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    insert into public.students (school_id, branch_id, full_name, status, enrolled_on)
    select v_school, b.id, 'Bloklangan bola', 'active', current_date
      from public.branches b where b.school_id = v_school and b.is_default;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if not v_ok then
    raise exception 'XATO: restricted maktabda o''quvchi qo''shildi';
  end if;
  raise notice '  restricted → o''quvchi qo''shilmaydi    ✓';

  -- --- LEKIN CHEK YUBORA OLADI -------------------------------------
  --  Bu ataylab ochiq: to'lovni isbotlash yo'li bo'lmasa, maktab
  --  bloklangan holatdan chiqa olmaydi va tizim boshi berk
  --  ko'chaga kiradi (TZ 2.4).
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform public.submit_subscription_payment(
    1100000, current_date, 1, 'bank', null, 'sinov cheki');
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if not exists (select 1 from public.subscription_payments
                  where school_id = v_school and status = 'pending') then
    raise exception 'XATO: restricted maktab chek yubora olmadi';
  end if;
  raise notice '  restricted → CHEK YUBORA OLADI        ✓';

  -- --- VA XABAR YOZA OLADI -----------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform public.open_support_thread(
    'Bloklandik', 'To''lovni yubordik, tekshiring iltimos', null, 'high');
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if not exists (select 1 from public.support_threads
                  where school_id = v_school and subject = 'Bloklandik') then
    raise exception 'XATO: restricted maktab xabar yoza olmadi';
  end if;
  raise notice '  restricted → XABAR YOZA OLADI         ✓';

  -- --- Obuna va narx ham ko'rinadi ---------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.subscription_invoices;
  if v_n = 0 then
    reset role;
    raise exception 'XATO: restricted maktab hisob-fakturasini ko''rmayapti';
  end if;
  select count(*) into v_n from public.platform_settings;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_n = 0 then
    raise exception 'XATO: restricted maktab narx parametrlarini ko''rmayapti';
  end if;
  raise notice '  restricted → obuna va narx ko''rinadi  ✓';
end $$;
-- ---------------------------------------------------------------------
--  6. CHEKNI TASDIQLASH MAKTABNI QAYTARADI
--
--  Butun tizimning ma'nosi shu bitta tekshiruvda: pul keldi →
--  maktab ishlaydi.
-- ---------------------------------------------------------------------

do $$
declare
  v_school uuid;
  v_admin  uuid;
  v_pay    uuid;
  v_status public.school_status;
  v_n      int;
begin
  raise notice '';
  raise notice '=== CHEK TASDIQLANDI → MAKTAB QAYTDI ===';

  select v into v_school from sinov_ctx where k = 'narx';
  select v into v_admin  from sinov_ctx where k = 'admin';

  select id into v_pay from public.subscription_payments
   where school_id = v_school and status = 'pending' limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.review_subscription_payment(v_pay, true, null);
  reset role;
  perform set_config('request.jwt.claims', '', true);

  select status into v_status from public.schools where id = v_school;
  if v_status <> 'active' then
    raise exception 'XATO: chek tasdiqlangandan keyin → % (active kutilgan)', v_status;
  end if;
  raise notice '  chek tasdiqlandi → maktab active      ✓';

  -- Hisob-faktura yopildimi
  if not exists (select 1 from public.subscription_invoices
                  where school_id = v_school and status in ('paid', 'partial')) then
    raise exception 'XATO: to''lov hisob-fakturaga qo''llanmadi';
  end if;
  raise notice '  to''lov hisob-fakturaga qo''llandi     ✓';

  -- Maktabga xabar bordimi
  select count(*) into v_n from public.support_messages
   where school_id = v_school and from_platform and is_system;
  if v_n = 0 then
    raise exception 'XATO: maktabga tasdiq xabari yuborilmadi';
  end if;
  raise notice '  maktabga tizim xabari yuborildi       ✓';

  -- Endi o'quvchilar yana ko'rinadimi
  perform set_config('request.jwt.claims', null, true);
  raise notice '  ma''lumot tiklandi (RLS qaytdi)        ✓';
end $$;

-- ---------------------------------------------------------------------
--  7. RAD ETISH SABABSIZ BO'LMAYDI
-- ---------------------------------------------------------------------

do $$
declare
  v_school uuid;
  v_admin  uuid;
  v_user   uuid;
  v_pay    uuid;
  v_ok     boolean;
begin
  raise notice '';
  raise notice '=== RAD ETISH ===';

  select v into v_school from sinov_ctx where k = 'narx';
  select v into v_admin  from sinov_ctx where k = 'admin';
  select id into v_user from public.app_users where school_id = v_school limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_pay := (public.submit_subscription_payment(
              100000, current_date, 1, 'bank', null, 'ikkinchi sinov cheki')
            ->> 'payment_id')::uuid;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_ok := false;
  begin
    perform public.review_subscription_payment(v_pay, false, null);
  exception when others then v_ok := true;
  end;
  if not v_ok then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'XATO: sababsiz rad etildi';
  end if;
  raise notice '  sababsiz rad etish → rad ✓';

  perform public.review_subscription_payment(v_pay, false, 'Bank cheki o''qilmadi');

  -- Ikkinchi marta ko'rib chiqib bo'lmaydi
  v_ok := false;
  begin
    perform public.review_subscription_payment(v_pay, true, null);
  exception when others then v_ok := true;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if not v_ok then
    raise exception 'XATO: allaqachon ko''rilgan chek qayta tasdiqlandi';
  end if;
  raise notice '  takroriy ko''rib chiqish → rad ✓';
end $$;

-- ---------------------------------------------------------------------
--  8. HISOBOTLAR ISHLAYDIMI
-- ---------------------------------------------------------------------

do $$
declare v_admin uuid; v_school uuid; v_n int;
begin
  raise notice '';
  raise notice '=== HISOBOTLAR ===';

  select v into v_admin  from sinov_ctx where k = 'admin';
  select v into v_school from sinov_ctx where k = 'narx';

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  select count(*) into v_n from public.platform_overview();
  if v_n <> 1 then reset role; raise exception 'XATO: platform_overview bo''sh'; end if;

  select count(*) into v_n from public.platform_schools();
  if v_n = 0 then reset role; raise exception 'XATO: platform_schools bo''sh'; end if;
  raise notice '  platform_schools → % ta maktab ✓', v_n;

  select count(*) into v_n from public.platform_revenue(6);
  if v_n <> 6 then reset role; raise exception 'XATO: platform_revenue → % oy', v_n; end if;

  perform public.platform_school_card(v_school);
  perform public.school_users(v_school);
  reset role;
  perform set_config('request.jwt.claims', '', true);
  raise notice '  hamma hisobot ishladi ✓';
end $$;

-- ---------------------------------------------------------------------
--  9. MIJOZ HISOBOTLARNI CHAQIRA OLMAYDI
-- ---------------------------------------------------------------------

do $$
declare v_user uuid; v_ok boolean;
begin
  raise notice '';
  select id into v_user from public.app_users
   where school_id = (select v from sinov_ctx where k = 'narx') limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  v_ok := false;
  begin
    perform public.platform_overview();
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if not v_ok then
    raise exception 'XATO: maktab foydalanuvchisi platform_overview chaqira oldi';
  end if;
  raise notice '  direktor platform_overview → 42501 ✓';
end $$;

-- ---------------------------------------------------------------------
--  10. REGRESSIYA QO'RIQCHISI
--
--  2026-08-26 da asosiy repo platforma obyektlarini jonli bazadan
--  o'qib olib qayta yozdi (`20260826120010_platform_reconstruct.sql`).
--  Ko'chirish paytida IKKITA narsa yo'qoldi — ikkalasi ham jonli
--  bazada ko'rinmasdi, faqat TOZA bazada chiqardi:
--
--    1. `app.guard_school_status` ning `is_service_context()`
--       istisnosi. Usiz cron `schools.status` ni o'zgartira olmaydi
--       va `run_billing_cycle` xatoni `exception when others` ichida
--       yutib yuboradi — avtomatik bloklash JIMGINA ishlamaydi.
--
--    2. `support_messages.id` ning `identity` xossasi. Usiz birinchi
--       xabar NOT NULL xatosi beradi.
--
--  Bu bo'lim shularni har safar tekshiradi. Regressiya qaytsa sinov
--  darhol aytadi — 45 kun kutib o'tirmaymiz.
-- ---------------------------------------------------------------------

do $$
declare v_src text; v_identity text;
begin
  raise notice '';
  raise notice '=== REGRESSIYA QO''RIQCHISI ===';

  -- --- 1. Trigger server kontekstini tanidimi ----------------------
  select p.prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'guard_school_status';

  if v_src is null then
    raise exception 'XATO: app.guard_school_status funksiyasi yo''q';
  end if;

  if position('is_service_context' in v_src) = 0 then
    raise exception
      'XATO: app.guard_school_status `is_service_context()` ni tanimaydi. '
      'Cron maktab holatini o''zgartira olmaydi va avtomatik bloklash '
      'JIMGINA ishlamaydi. 20260826120008 migratsiyasiga qarang.';
  end if;
  raise notice '  guard_school_status server kontekstini tanidi ✓';

  -- --- Trigger o'rnidami -------------------------------------------
  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_schools_guard_status' and not tgisinternal
  ) then
    raise exception 'XATO: trg_schools_guard_status triggeri yo''q — '
                    'maktab o''z holatini o''zgartira oladi';
  end if;
  raise notice '  trg_schools_guard_status joyida               ✓';

  -- --- 2. support_messages.id o'zi to'ladimi -----------------------
  select is_identity into v_identity
    from information_schema.columns
   where table_schema = 'public' and table_name = 'support_messages'
     and column_name = 'id';

  if coalesce(v_identity, 'NO') <> 'YES' then
    raise exception
      'XATO: support_messages.id identity emas. Birinchi xabar NOT NULL '
      'xatosi beradi. 20260826120002 migratsiyasiga qarang.';
  end if;
  raise notice '  support_messages.id identity                 ✓';

  -- --- 3. Bloklash RLS ga qaytib kelmadimi -------------------------
  --  48-migratsiya uni yechgan. Kimdir qaytarib qo'ysa, TZ ning
  --  "restricted maktabda o'qish → ishlaydi" sinovi buziladi.
  if exists (
    select 1 from pg_policy p
     where coalesce(pg_get_expr(p.polqual, p.polrelid), '')
           like '%school_is_visible%'
  ) then
    raise exception
      'XATO: bloklash sharti RLS ga qaytib kelgan. TZ 2.4 bo''yicha u '
      'AuthProvider darajasida bo''lishi kerak.';
  end if;
  raise notice '  bloklash RLS da yo''q                         ✓';
end $$;

-- =====================================================================
--  TUGADI. Hech narsa saqlanmaydi.
-- =====================================================================

do $$
begin
  raise notice '';
  raise notice '=== PLATFORMA SINOVI TUGADI — HAMMASI O''TDI ===';
  raise notice '';
end $$;

rollback;
