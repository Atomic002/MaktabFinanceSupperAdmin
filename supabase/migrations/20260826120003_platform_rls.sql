-- =====================================================================
--  41 — YANGI JADVALLAR UCHUN RLS VA BLOKLASH HIMOYASI
--
--  Ikkita ish qiladi:
--
--  1) Yangi jadvallarga siyosat qo'yadi. Hammasi FAQAT O'QISH —
--     yozish `security definer` RPC orqali (TZ 5.4.6 bilan bir xil
--     mantiq: pul bilan bog'liq yozuv siyosat orqali kirmaydi).
--
--  2) `suspended` holatini KUCHGA KIRITADI.
--
--  MUAMMO: `restricted` maktab yozolmaydi, lekin hamma narsani
--  o'qiy oladi. To'lovni umuman qilmagan maktab uchun bu yetarli
--  emas — u yillab bepul ishlatib turaveradi.
--
--  YECHIM: `suspended` holatida MA'LUMOT KO'RINMAYDI. Ma'lumot
--  o'chirilmaydi, hech narsa yo'qolmaydi — shunchaki qaytarilmaydi.
--  To'lov tasdiqlangan zahoti holat `active` ga qaytadi va hamma
--  narsa joyida bo'ladi.
--
--  OCHIQ QOLADIGANLAR (ro'yxat quyida, `v_allow`): maktab o'z
--  holatini, hisob-fakturasini, chekini va yozishmani KO'RISHI
--  SHART. Aks holda "bloklandingiz, sababini ham bilmaysiz,
--  gaplashib ham bo'lmaydi" degan holat kelib chiqadi.
--
--  NEGA SIYOSATLAR QO'LDA KO'CHIRILMAYDI: 106 ta siyosat bor.
--  Qo'lda yozilsa bittasi albatta unutiladi va o'sha teshik bo'lib
--  qoladi. Migratsiya 36 dagi usul takrorlanadi — mavjud ifoda
--  o'qiladi, shartga o'raladi, qaytadan yaratiladi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. KO'RINISH SHARTI
--
--  `security definer` — `schools` ustidagi RLS ni chetlab o'tib
--  holatni o'qiy olishi kerak, aks holda o'z-o'ziga rekursiya.
-- ---------------------------------------------------------------------

create or replace function app.school_is_visible()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or exists (
           select 1
             from public.schools s
             join public.app_users u on u.school_id = s.id
            where u.id = (select auth.uid())
              and u.is_active
              and u.deleted_at is null
              and s.deleted_at is null
              and s.status <> 'suspended'
         );
$$;

comment on function app.school_is_visible() is
  'To''lov 45 kundan ortiq kechikkanda (status = suspended) maktab '
  'ma''lumoti QAYTARILMAYDI. Ma''lumot o''chirilmaydi — to''lovdan '
  'keyin hammasi joyida qaytadi.';

revoke all on function app.school_is_visible() from public, anon;
grant execute on function app.school_is_visible() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. YANGI JADVALLAR — SIYOSATLAR
--
--  Naqsh mavjud platforma jadvallari bilan bir xil:
--    · maktab o'zinikini ko'radi
--    · super admin hammasini ko'radi
--    · yozish siyosati YO'Q
-- ---------------------------------------------------------------------

-- --- platform_settings ------------------------------------------------
--  Narx parametrlari maktabga ham ko'rinadi (`is_public`), ichki
--  sozlamalar esa faqat platformaga.
alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_select on public.platform_settings;
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using (is_public or (select app.is_platform_admin()));

grant select on public.platform_settings to authenticated;

-- --- Maktabga bog'langan platforma jadvallari -------------------------
do $do$
declare
  t text;
begin
  foreach t in array array[
    'subscription_invoices',
    'subscription_payments',
    'support_threads',
    'support_messages'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format($f$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (school_id = (select app.school_id())
               or (select app.is_platform_admin()))
    $f$, t);

    -- TZ 5.4.6 / 5.4.13 — INSERT va UPDATE siyosati ATAYLAB yo'q.
    -- Obuna to'lovi ham, yozishma ham RPC orqali yoziladi.
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $do$;

-- Moliyaviy o'zgarish maktabning O'Z jurnalida ham ko'rinsin —
-- direktor "kim qachon nima qildi" degan savolga javob topsin.
select app.attach_audit_trigger('subscription_invoices');
select app.attach_audit_trigger('subscription_payments');

-- ---------------------------------------------------------------------
-- 3. BLOKLASH — MAVJUD SIYOSATLARGA SHART QO'SHISH
--
--  Har bir SELECT siyosatining ifodasi o'qiladi va
--  `and (select app.school_is_visible())` bilan o'raladi.
--
--  `(select ...)` shakli MAJBURIY (migratsiya 36): aks holda shart
--  har bir qator uchun qayta hisoblanadi va hisobotlar vaqt
--  chegarasiga uriladi.
-- ---------------------------------------------------------------------

do $do$
declare
  r         record;
  v_cmd     text;
  v_kind    text;
  v_n       int := 0;
  -- Bloklangan maktab ham KO'RISHI kerak bo'lgan jadvallar.
  v_allow   text[] := array[
    'schools',                 -- o'z holatini bilishi shart
    'app_users',               -- kirish konteksti
    'role_permissions',        -- huquqlar
    'plans',                   -- tariflar katalogi
    'platform_settings',       -- narx parametrlari
    'school_subscriptions',    -- obuna holati
    'subscription_invoices',   -- qancha qarz
    'subscription_payments',   -- yuborilgan cheklar
    'support_threads',         -- yozishma
    'support_messages',
    'platform_admins',
    'platform_log',
    'impersonation_sessions',  -- TZ 4.13.5.2 — direktor ko'rishi shart
    'impersonation_log'
  ];
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
     and p.polcmd in ('r', '*')            -- SELECT va ALL
     and not (c.relname = any (v_allow))
   order by c.relname, p.polname
  loop
    -- Ifodasiz siyosat bo'lmaydi, lekin bo'lsa — tegmaymiz.
    continue when r.qual is null;
    -- Migratsiya qayta ishga tushsa ikki marta o'ralmasin.
    continue when r.qual like '%school_is_visible%';

    v_cmd := case r.cmd when 'r' then 'select' else 'all' end;
    v_kind := case when r.permissive then 'permissive' else 'restrictive' end;

    execute format('drop policy %I on public.%I', r.pol, r.tbl);

    -- DIQQAT: `with check` uchun `format` ISHLATILMAYDI — u null ni
    -- bo'sh satrga aylantiradi va `with check ()` degan buzuq SQL
    -- chiqadi. Konkatenatsiyada esa null butun ifodani null qiladi
    -- va `coalesce` uni tashlab yuboradi (migratsiya 36 dagi usul).
    execute
      format('create policy %I on public.%I as %s for %s to %s',
             r.pol, r.tbl, v_kind, v_cmd, r.roles)
      || ' using ((' || r.qual || ') and (select app.school_is_visible()))'
      || coalesce(' with check (' || r.chk || ')', '');

    v_n := v_n + 1;
  end loop;

  raise notice 'Bloklash sharti % ta siyosatga qo''shildi', v_n;
end $do$;

-- ---------------------------------------------------------------------
-- 4. FAYLLAR HAM YOPILADI
--
--  Ma'lumot ko'rinmasa ham, eski havolani saqlab qo'ygan odam
--  faylni ochib qolmasin. `subscription-receipts` bunga KIRMAYDI —
--  o'z chekini ko'rish har doim ochiq.
-- ---------------------------------------------------------------------

do $do$
declare
  b text;
begin
  foreach b in array array['receipts', 'statements', 'expense-docs']
  loop
    execute format('drop policy if exists %I on storage.objects', b || '_read');
    execute format($f$
      create policy %I on storage.objects
        for select to authenticated
        using (
          bucket_id = %L
          and (storage.foldername(name))[1] = (select app.school_id())::text
          and (select app.school_is_visible())
        )
    $f$, b || '_read', b);
  end loop;
end $do$;

-- ---------------------------------------------------------------------
-- 5. TEKSHIRUV
--
--  Migratsiya 36 ning qoidasi buzilmaganini tasdiqlaymiz: har bir
--  `app.*()` chaqiruvi `(select ...)` ichida bo'lishi shart.
-- ---------------------------------------------------------------------

do $do$
declare v_bad text; v_n int;
begin
  select string_agg(c.relname || '.' || p.polname, ', '), count(*)
    into v_bad, v_n
    from pg_policy p
    join pg_class c     on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace,
    lateral (select coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' '
                 || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as e) x
   where n.nspname = 'public'
     and regexp_count(x.e, 'app\.[a-z_]+\(') >
         regexp_count(x.e, 'SELECT\s+app\.[a-z_]+\(');

  if v_n > 0 then
    raise exception 'O''ralmagan chaqiruv qoldi (% ta): %', v_n, v_bad;
  end if;

  raise notice 'Tekshiruv: barcha chaqiruv (select ...) ichida';
end $do$;

-- Yangi jadvallarda RLS yoqilganini tasdiqlaymiz (invariant 1).
do $do$
declare v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if v_bad is not null then
    raise exception 'RLS yoqilmagan jadval: %', v_bad;
  end if;

  raise notice 'Tekshiruv: barcha jadvalda RLS yoqilgan';
end $do$;
