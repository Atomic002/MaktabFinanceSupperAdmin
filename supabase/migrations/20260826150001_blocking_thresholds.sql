-- =====================================================================
--  49 — BLOKLASH ZINAPOYASI TZ GA KELTIRILADI
--
--  MUAMMO. Amaldagi zinapoya TZ 2.4 va M7 bilan mos emas edi:
--
--                       edi              TZ talabi
--    muddat o'tdi       grace            (o'zgarish yo'q)
--    +15 kun            restricted       eslatma, holat o'zgarmaydi
--    +30 kun            —                grace
--    +45 kun            suspended        restricted  ← oxirgi bosqich
--
--  Ikkita farq muhim:
--
--    1. MIJOZGA BERILADIGAN MUDDAT. Eskisida to'lov kechikkan maktab
--       15 kunda yozishdan mahrum bo'lardi. TZ 30 kun beradi va
--       oralig'ida ikkita eslatma yuboriladi.
--
--    2. `suspended` DEGAN HOLAT TZ DA UMUMAN YO'Q. `school_status`
--       enumida to'rtta qiymat: trial, active, restricted, archived.
--       `restricted` — oxirgi bosqich, undan keyin faqat qo'lda
--       `archived` bor.
--
--  YECHIM. Zinapoya ikki bosqichli bo'ladi:
--
--    | kechikish | obuna      | maktab     |
--    |-----------|------------|------------|
--    | < 0       | active     | active     |
--    | 0 … 29    | active     | active     |
--    | 30 … 44   | grace      | active     |
--    | 45+       | restricted | restricted |
--
--  `restricted` da baza O'QISHGA OCHIQ qoladi (migratsiya 48 ni
--  ko'ring) — kirishni panel to'sadi. Yozish esa allaqachon
--  `app.school_is_writable()` bilan to'silgan va u tegilmaydi.
--
--  DIQQAT — KESISHGAN BOG'LIQLIK. `app.sync_subscription_amount()`
--  asosiy repoda (`20260826140000`) yashaydi va narxni har kuni
--  yangilab turadi. U `recompute_school_billing` ichiga o'sha
--  migratsiya tomonidan MATN ALMASHTIRISH bilan ulangan edi. Biz
--  funksiyani qaytadan yozayapmiz, ya'ni o'sha ulanish yo'qoladi —
--  shuning uchun chaqiruv shu yerda qayta tiklanadi. Lekin ikkita
--  repo bitta bazani bo'lishgani uchun funksiya mavjud bo'lmasligi
--  ham mumkin (faqat super admin repo qo'llangan bo'lsa), shuning
--  uchun chaqiruv `to_regprocedure` bilan himoyalangan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SOZLAMALAR
--
--  `suspend_days` nomi endi chalg'ituvchi: `suspended` degan holat
--  yo'q. `block_days` deb qayta nomlanadi.
-- ---------------------------------------------------------------------

update public.platform_settings
   set value = to_jsonb(30),
       note  = 'Muddatdan keyin necha kunda grace holatiga o''tadi'
 where key = 'billing.grace_days';

insert into public.platform_settings (key, value, note, is_public)
values ('billing.block_days', to_jsonb(45),
        'Muddatdan keyin necha kunda bloklanadi (restricted)', true)
on conflict (key) do update
  set value = to_jsonb(45),
      note  = excluded.note;

delete from public.platform_settings where key = 'billing.suspend_days';

-- ---------------------------------------------------------------------
-- 2. ZINAPOYA
-- ---------------------------------------------------------------------

create or replace function app.recompute_school_billing(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grace   int := coalesce(app.billing_num('billing.grace_days'), 30)::int;
  v_block   int := coalesce(app.billing_num('billing.block_days'), 45)::int;
  v_sub     public.school_subscriptions%rowtype;
  v_school  public.schools%rowtype;
  v_overdue int;
  v_new_sub public.subscription_status;
  v_new_sch public.school_status;
begin
  select * into v_sub
    from public.school_subscriptions
   where school_id = p_school_id and status <> 'cancelled'
   limit 1;

  if not found then
    return jsonb_build_object('school_id', p_school_id, 'changed', false,
                              'reason', 'obuna yo''q');
  end if;

  select * into v_school from public.schools where id = p_school_id;

  -- Arxivlangan maktab to'lov zinapoyasidan chiqariladi.
  if v_school.status = 'archived' or v_school.deleted_at is not null then
    return jsonb_build_object('school_id', p_school_id, 'changed', false,
                              'reason', 'arxiv');
  end if;

  --  Narx har kuni qayta hisoblanadi: filial qo'shilsa yoki o'quvchi
  --  soni limitdan oshsa, saqlangan summa eskirmasin.
  if to_regprocedure('app.sync_subscription_amount(uuid)') is not null then
    perform app.sync_subscription_amount(p_school_id);
  end if;

  -- --- Sinov muddati hali tugamagan ---------------------------------
  if v_sub.status = 'trial'
     and v_sub.trial_ends_at is not null
     and v_sub.trial_ends_at >= current_date then
    v_new_sub := 'trial';
    v_new_sch := 'trial';

  elsif v_sub.next_payment_date is null then
    -- Muddat qo'yilmagan bo'lsa kechikish hisoblanmaydi.
    v_new_sub := 'active';
    v_new_sch := 'active';

  else
    v_overdue := current_date - v_sub.next_payment_date;

    if v_overdue < v_grace then
      --  Bu shoxga muddat kelmagani (< 0) va birinchi 30 kun ham
      --  kiradi: TZ bo'yicha 15- va 30-kun faqat ESLATMA, holat
      --  o'zgarmaydi.
      v_new_sub := 'active';     v_new_sch := 'active';
    elsif v_overdue < v_block then
      v_new_sub := 'grace';      v_new_sch := 'active';
    else
      v_new_sub := 'restricted'; v_new_sch := 'restricted';
    end if;
  end if;

  if v_new_sub = v_sub.status and v_new_sch = v_school.status then
    return jsonb_build_object('school_id', p_school_id, 'changed', false,
                              'status', v_new_sch, 'overdue_days', v_overdue);
  end if;

  update public.school_subscriptions set status = v_new_sub where id = v_sub.id;
  update public.schools              set status = v_new_sch where id = p_school_id;

  perform app.plog(
    'billing_status_recomputed', 'schools', p_school_id::text, p_school_id,
    jsonb_build_object('school_status', v_school.status,
                       'subscription_status', v_sub.status),
    jsonb_build_object('school_status', v_new_sch,
                       'subscription_status', v_new_sub,
                       'overdue_days', v_overdue));

  return jsonb_build_object(
    'school_id', p_school_id, 'changed', true,
    'from', v_school.status, 'status', v_new_sch,
    'subscription_status', v_new_sub, 'overdue_days', v_overdue);
end;
$$;

comment on function app.recompute_school_billing(uuid) is
  'To''lov kechikishiga qarab maktab va obuna holatini qayta '
  'hisoblaydi (TZ 2.4): 30 kun → grace, 45 kun → restricted. '
  'Bloklash zinapoyasining YAGONA manbasi.';

revoke all on function app.recompute_school_billing(uuid)
  from public, anon, authenticated;
grant execute on function app.recompute_school_billing(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 3. `suspended` HOLATIDAGI MAKTABLARNI QAYTARISH
--
--  Hozir bunday maktab yo'q, lekin migratsiya boshqa muhitda ham
--  ishlashi kerak. O'zgarish jurnalga tushadi — holat o'zgarishi
--  hujjatsiz qolmasin.
-- ---------------------------------------------------------------------

do $do$
declare s record; v_n int := 0;
begin
  for s in select id, name from public.schools where status = 'suspended'
  loop
    update public.schools set status = 'restricted' where id = s.id;
    update public.school_subscriptions
       set status = 'restricted'
     where school_id = s.id and status = 'suspended';

    perform app.plog('billing_status_recomputed', 'schools', s.id::text, s.id,
                     jsonb_build_object('school_status', 'suspended'),
                     jsonb_build_object('school_status', 'restricted',
                       'reason', 'suspended bekor qilindi (TZ 2.4)'));
    v_n := v_n + 1;
  end loop;

  if v_n > 0 then
    raise notice '% ta maktab suspended dan restricted ga o''tkazildi', v_n;
  end if;
end $do$;

-- ---------------------------------------------------------------------
-- 4. ENUM QIYMATINI BELGILASH
--
--  PostgreSQL da enum qiymatini olib tashlab bo'lmaydi. Shuning uchun
--  u qoladi, lekin izoh keyingi o'quvchiga uni ishlatmaslikni aytadi.
-- ---------------------------------------------------------------------

comment on type public.school_status is
  'trial, active, restricted, archived. DIQQAT: `suspended` qiymati '
  '49-migratsiyadan boshlab ISHLATILMAYDI — bloklashning oxirgi '
  'bosqichi `restricted` (TZ 2.4). Enum qiymatini olib tashlab '
  'bo''lmaydi.';

comment on type public.subscription_status is
  'trial, active, grace, restricted, cancelled. `suspended` qiymati '
  'ISHLATILMAYDI — 49-migratsiyaga qarang.';

-- ---------------------------------------------------------------------
-- 5. TEKSHIRUV
-- ---------------------------------------------------------------------

do $do$
declare v_n int;
begin
  select count(*) into v_n from public.schools where status = 'suspended';
  if v_n > 0 then
    raise exception 'Hamon % ta maktab suspended holatida', v_n;
  end if;

  if coalesce(app.billing_num('billing.grace_days'), 0) <> 30 then
    raise exception 'grace_days 30 bo''lishi kerak edi';
  end if;
  if coalesce(app.billing_num('billing.block_days'), 0) <> 45 then
    raise exception 'block_days 45 bo''lishi kerak edi';
  end if;

  raise notice 'Tekshiruv: zinapoya 30/45, suspended holatida maktab yo''q';
end $do$;
