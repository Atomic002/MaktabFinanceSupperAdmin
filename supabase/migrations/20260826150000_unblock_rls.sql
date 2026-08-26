-- =====================================================================
--  48 — BLOKLASH RLS DAN YECHILADI
--
--  MUAMMO. Migratsiya 41 bloklashni RLS ga qo'ygan edi: 45 ta
--  siyosatga `and (select app.school_is_visible())` sharti
--  qo'shilgan. Texnik jihatdan u ishlaydi — bloklangan maktab
--  ma'lumotni `curl` bilan ham ololmaydi.
--
--  Lekin TZ buni ATAYLAB rad etadi va sababini ikki marta yozadi
--  (2.4 "Kirish darajasi" va P2 izohi):
--
--      "Nega bazada emas: RLS ni yopib qo'yish direktorni ham,
--       to'lovni yuborish imkoniyatidan ham mahrum qiladi. To'lov
--       ekrani ochiq qolishi SHART — aks holda mijoz to'lay olmaydi
--       va tugab qoladi."
--
--  Menda bu xavf yopilgan edi — to'lov va yozishma jadvallari
--  ro'yxatdan chiqarilgan. Lekin TZ da yana ikkita talab bor:
--
--    · qabul sinovi: "`restricted` maktabda o'qish → ISHLAYDI";
--    · qat'iy talab #6: o'nta invariant buzilmaydi — bu esa RLS
--      qatlamini iloji boricha sodda tutishni talab qiladi.
--
--  Bundan tashqari amaliy sabab bor: 45 ta siyosatga qo'shilgan shart
--  har bir kelajakdagi migratsiyada hisobga olinishi kerak edi. Kim
--  bo'lmasin yangi jadval qo'shsa va shartni unutsa, bloklash o'sha
--  jadvalda ishlamay qolardi — va buni hech kim sezmasdi.
--
--  YECHIM. Bloklash `AuthProvider` darajasiga ko'chadi: `restricted`
--  maktabga panel o'rniga to'lov ekrani ko'rsatiladi. Baza esa
--  o'qishga ochiq qoladi — YOZISH allaqachon `app.school_is_writable()`
--  bilan to'silgan va u tegilmaydi.
--
--  NEGA SIYOSATLAR QO'LDA KO'CHIRILMAYDI: 45 ta siyosat bor va ularning
--  asl ifodasi har xil. Migratsiya 36 va 41 dagi naqsh takrorlanadi —
--  mavjud ifoda O'QILADI, shart olib tashlanadi, siyosat qaytadan
--  yaratiladi. Shunda bironta e'tibordan chetda qolmaydi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. `public` SIYOSATLARIDAN SHARTNI OLIB TASHLASH
--
--  Saqlangan shakl hamma joyda bir xil, chunki uni migratsiya 41
--  bitta naqsh bilan qo'shgan:
--
--    (<asl ifoda> AND ( SELECT app.school_is_visible() AS school_is_visible))
--
--  Postgres ifodani qayta shakllantirib saqlaydi, shuning uchun
--  naqsh AYNAN shu ko'rinishda bo'ladi — `(select ...)` emas,
--  `( SELECT ... AS ...)`.
-- ---------------------------------------------------------------------

do $do$
declare
  r         record;
  v_qual    text;
  v_cmd     text;
  v_kind    text;
  v_n       int := 0;
  v_skipped int := 0;
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
     and pg_get_expr(p.polqual, p.polrelid) like '%school_is_visible%'
   order by c.relname, p.polname
  loop
    v_qual := regexp_replace(
      r.qual,
      '^\((.*) AND \( SELECT app\.school_is_visible\(\) AS school_is_visible\)\)$',
      '\1');

    -- Naqsh mos kelmasa TEGMAYMIZ. Yarim tuzatilgan siyosat —
    -- umuman tuzatilmaganidan xavfliroq: u ishlayotgandek ko'rinadi.
    if v_qual = r.qual then
      v_skipped := v_skipped + 1;
      raise warning 'Naqsh mos kelmadi, tegilmadi: %.%  →  %',
        r.tbl, r.pol, r.qual;
      continue;
    end if;

    v_cmd  := case r.cmd when 'r' then 'select' when 'a' then 'insert'
                         when 'w' then 'update' when 'd' then 'delete'
                         else 'all' end;
    v_kind := case when r.permissive then 'permissive' else 'restrictive' end;

    execute format('drop policy %I on public.%I', r.pol, r.tbl);

    -- `with check` uchun `format` ISHLATILMAYDI — u null ni bo'sh
    -- satrga aylantiradi va `with check ()` degan buzuq SQL chiqadi.
    execute
      format('create policy %I on public.%I as %s for %s to %s',
             r.pol, r.tbl, v_kind, v_cmd, r.roles)
      || ' using (' || v_qual || ')'
      || coalesce(' with check (' || r.chk || ')', '');

    v_n := v_n + 1;
  end loop;

  raise notice 'Bloklash sharti % ta siyosatdan olib tashlandi', v_n;

  if v_skipped > 0 then
    raise exception
      '% ta siyosatda naqsh mos kelmadi — yuqoridagi ogohlantirishlarga '
      'qarang va ularni qo''lda tuzating', v_skipped;
  end if;
end $do$;

-- ---------------------------------------------------------------------
-- 2. STORAGE SIYOSATLARI
--
--  Bu uchtasi migratsiya 41 da to'liq qayta yozilgan edi, shuning
--  uchun ularni regex bilan emas, ASL HOLIDA qayta yaratamiz —
--  migratsiya 15 dagi naqsh, lekin `(select ...)` o'ramasi bilan
--  (migratsiya 36 qoidasi).
-- ---------------------------------------------------------------------

do $do$
declare b text;
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
        )
    $f$, b || '_read', b);
  end loop;

  raise notice 'Storage siyosatlari asl holiga qaytarildi';
end $do$;

-- ---------------------------------------------------------------------
-- 3. FUNKSIYANI O'CHIRISH
--
--  Ishlatilmaydigan funksiya qolsa, keyingi o'quvchi "demak bloklash
--  bazada" deb o'ylaydi va noto'g'ri joyda qidiradi.
-- ---------------------------------------------------------------------

drop function if exists app.school_is_visible();

-- ---------------------------------------------------------------------
-- 4. TEKSHIRUV
-- ---------------------------------------------------------------------

do $do$
declare v_bad text; v_n int;
begin
  -- --- 4a. Hech qayerda qolmadimi ---------------------------------
  select string_agg(c.relname || '.' || p.polname, ', '), count(*)
    into v_bad, v_n
    from pg_policy p
    join pg_class c     on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where coalesce(pg_get_expr(p.polqual, p.polrelid), '')
         || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
         like '%school_is_visible%';

  if v_n > 0 then
    raise exception 'school_is_visible hamon % ta siyosatda: %', v_n, v_bad;
  end if;
  raise notice 'Tekshiruv: bloklash sharti hech qayerda qolmadi';

  -- --- 4b. Migratsiya 36 qoidasi buzilmadimi ----------------------
  --  Har bir `app.*()` chaqiruvi `(select ...)` ichida bo'lishi
  --  shart, aks holda hisobotlar vaqt chegarasiga uriladi.
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
    raise exception 'O''ralmagan chaqiruv paydo bo''ldi (% ta): %', v_n, v_bad;
  end if;
  raise notice 'Tekshiruv: barcha chaqiruv (select ...) ichida';
end $do$;
