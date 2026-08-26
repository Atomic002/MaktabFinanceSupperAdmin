-- =====================================================================
--  42 — PLATFORMA BOSHQARUV FUNKSIYALARI
--
--  MUAMMO: `platform_admins` va `platform_log` da faqat SELECT
--  siyosati bor, `impersonation_sessions` da esa umuman yo'q. Ya'ni
--  super admin panel orqali BIRORTA platforma yozuvini yoza olmaydi.
--  Bu ataylab: yozish har doim tekshiruvdan va jurnaldan o'tishi
--  kerak.
--
--  YECHIM: har bir amal — alohida `security definer` funksiya. Ular
--  uchta ishni BIRGA bajaradi:
--    1. huquqni tekshiradi (aks holda 42501)
--    2. o'zgarishni qiladi
--    3. `platform_log` ga oldingi va yangi holat bilan yozadi
--
--  Uchtasi bitta tranzaksiyada — jurnalsiz o'zgarish TEXNIK
--  JIHATDAN imkonsiz (TZ 4.13.7).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. JURNAL YORDAMCHISI
--
--  Har bir funksiyada `insert into platform_log ...` ni takrorlash
--  o'rniga bitta chaqiruv. Ustun qo'shilsa bir joy o'zgaradi.
-- ---------------------------------------------------------------------

create or replace function app.plog(
  p_action    text,
  p_entity    text,
  p_entity_id text,
  p_school_id uuid,
  p_before    jsonb default null,
  p_after     jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.platform_log
    (admin_id, action, entity, entity_id, school_id, before, after)
  values (
    -- DIQQAT: `admin_id` da `platform_admins` ga FK bor. Bu jurnalga
    -- MAKTAB ham sabab bo'ladi (direktor obuna cheki yuborganda), va
    -- o'shanda `auth.uid()` direktorning ID si — u `platform_admins`
    -- da YO'Q. Shartsiz yozilsa 23503 chiqadi: direktor chek yubora
    -- olmaydi, ya'ni bloklangan holatdan chiqish eshigi qulflanadi.
    case when app.is_platform_admin() then (select auth.uid()) end,
    p_action, p_entity, p_entity_id, p_school_id, p_before,
    -- Haqiqiy ijrochi har doim saqlanadi — kim qilgani yo'qolmaydi.
    coalesce(p_after, '{}'::jsonb)
      || jsonb_build_object(
           'by_user',     (select auth.uid()),
           'by_platform', app.is_platform_admin())
  );
$$;

comment on function app.plog(text, text, text, uuid, jsonb, jsonb) is
  'Super admin amalini jurnalga yozadi. `admin_id` faqat platforma '
  'admini uchun to''ldiriladi, haqiqiy ijrochi `after.by_user` da. '
  'Barcha platforma RPC lari shu funksiyani chaqiradi — jurnalga '
  'yozmaslik imkoniyati yo''q.';

revoke all on function app.plog(text, text, text, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function app.plog(text, text, text, uuid, jsonb, jsonb)
  to service_role;

-- ---------------------------------------------------------------------
-- 2. HUQUQ TEKSHIRUVI
--
--  Bitta joy. "Bu funksiyada tekshirish unutilibdi" degan xato
--  bo'lmasligi uchun har bir RPC birinchi qatorda shuni chaqiradi.
-- ---------------------------------------------------------------------

create or replace function app.require_platform_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not app.is_platform_admin() then
    raise exception 'Bu amal faqat platforma operatori uchun'
      using errcode = '42501';
  end if;
  v_id := (select auth.uid());
  return v_id;
end;
$$;

revoke all on function app.require_platform_admin() from public, anon;
grant execute on function app.require_platform_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. TO'LOV HOLATINI QAYTA HISOBLASH
--
--  Bloklash zinapoyasi. BITTA joyda — cron ham, to'lov tasdiqlash
--  ham, qo'lda o'zgartirish ham shu funksiyani chaqiradi. Aks holda
--  "cron bir xil, to'lov boshqacha hisoblaydi" degan farq paydo
--  bo'ladi va maktab noto'g'ri bloklanadi.
--
--    kechikish < 0        →  active      (yoki trial)
--    0 … grace_days       →  grace       — ishlaydi, ogohlantirish
--    grace_days … suspend →  restricted  — faqat o'qish
--    suspend_days dan ko'p→  suspended   — umuman kirmaydi
--
--  `cancelled` obunaga TEGILMAYDI — u shartnoma tugagani, kechikish
--  emas.
-- ---------------------------------------------------------------------

create or replace function app.recompute_school_billing(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grace   int := coalesce(app.billing_num('billing.grace_days'), 15)::int;
  v_suspend int := coalesce(app.billing_num('billing.suspend_days'), 45)::int;
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

  -- --- Sinov muddati hali tugamagan ---------------------------------
  if v_sub.status = 'trial'
     and v_sub.trial_ends_at is not null
     and v_sub.trial_ends_at >= current_date then
    v_new_sub := 'trial';
    v_new_sch := 'trial';
  else
    -- Muddat qo'yilmagan bo'lsa kechikish hisoblanmaydi.
    if v_sub.next_payment_date is null then
      v_new_sub := 'active';
      v_new_sch := 'active';
    else
      v_overdue := current_date - v_sub.next_payment_date;

      if v_overdue < 0 then
        v_new_sub := 'active';    v_new_sch := 'active';
      elsif v_overdue < v_grace then
        v_new_sub := 'grace';     v_new_sch := 'active';
      elsif v_overdue < v_suspend then
        v_new_sub := 'restricted'; v_new_sch := 'restricted';
      else
        v_new_sub := 'suspended';  v_new_sch := 'suspended';
      end if;
    end if;
  end if;

  if v_new_sub = v_sub.status and v_new_sch = v_school.status then
    return jsonb_build_object('school_id', p_school_id, 'changed', false,
                              'status', v_new_sch, 'overdue_days', v_overdue);
  end if;

  update public.school_subscriptions
     set status = v_new_sub
   where id = v_sub.id;

  update public.schools
     set status = v_new_sch
   where id = p_school_id;

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
  'hisoblaydi. Bloklash zinapoyasining YAGONA manbasi.';

revoke all on function app.recompute_school_billing(uuid)
  from public, anon, authenticated;
grant execute on function app.recompute_school_billing(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 4. MAKTAB HOLATINI QO'LDA O'ZGARTIRISH (TZ M2)
--
--  `app.guard_school_status()` triggeri maktab foydalanuvchisini
--  to'xtatadi, lekin platforma uchun funksiya yozilmagan edi.
-- ---------------------------------------------------------------------

create or replace function public.set_school_status(
  p_school_id uuid,
  p_status    public.school_status,
  p_reason    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := app.require_platform_admin();
  v_old   public.school_status;
begin
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'Sabab ko''rsatilishi shart (kamida 5 belgi)'
      using errcode = '22023';
  end if;

  select status into v_old from public.schools where id = p_school_id;
  if not found then
    raise exception 'Maktab topilmadi' using errcode = 'P0002';
  end if;

  if v_old = p_status then
    return jsonb_build_object('school_id', p_school_id, 'changed', false,
                              'status', p_status);
  end if;

  update public.schools set status = p_status where id = p_school_id;

  perform app.plog('school_status_changed', 'schools',
                   p_school_id::text, p_school_id,
                   jsonb_build_object('status', v_old),
                   jsonb_build_object('status', p_status,
                                      'reason', btrim(p_reason),
                                      'admin_id', v_admin));

  return jsonb_build_object('school_id', p_school_id, 'changed', true,
                            'from', v_old, 'status', p_status);
end;
$$;

comment on function public.set_school_status(uuid, public.school_status, text) is
  'TZ M2 — maktab holatini platforma o''zgartiradi. Sabab majburiy, '
  'oldingi va yangi holat jurnalga tushadi.';

revoke all on function public.set_school_status(uuid, public.school_status, text)
  from public, anon;
grant execute on function public.set_school_status(uuid, public.school_status, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. TARIFNI O'ZGARTIRISH (TZ M3)
--
--  Tarif `plans` katalogidan tanlanadi, lekin OYLIK SUMMA formuladan
--  hisoblanadi — maktab o'lchamiga qarab. Tarif bu yerda cheklovlar
--  (max_students, max_branches) va nom uchun xizmat qiladi.
-- ---------------------------------------------------------------------

create or replace function public.set_school_plan(
  p_school_id uuid,
  p_plan_code text,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := app.require_platform_admin();
  v_plan   public.plans%rowtype;
  v_sub    public.school_subscriptions%rowtype;
  v_price  numeric;
begin
  select * into v_plan from public.plans where code = p_plan_code and is_active;
  if not found then
    raise exception 'Tarif topilmadi: %', p_plan_code using errcode = 'P0002';
  end if;

  select * into v_sub
    from public.school_subscriptions
   where school_id = p_school_id and status <> 'cancelled'
   limit 1;
  if not found then
    raise exception 'Maktabda faol obuna yo''q' using errcode = 'P0002';
  end if;

  v_price := (public.school_price(p_school_id) ->> 'monthly_total')::numeric;

  update public.school_subscriptions
     set plan_id = v_plan.id,
         monthly_amount = v_price
   where id = v_sub.id;

  perform app.plog('school_plan_changed', 'school_subscriptions',
                   v_sub.id::text, p_school_id,
                   jsonb_build_object('plan_id', v_sub.plan_id,
                                      'monthly_amount', v_sub.monthly_amount),
                   jsonb_build_object('plan_id', v_plan.id,
                                      'plan_code', v_plan.code,
                                      'monthly_amount', v_price,
                                      'reason', btrim(coalesce(p_reason, '')),
                                      'admin_id', v_admin));

  return jsonb_build_object('school_id', p_school_id, 'plan_code', v_plan.code,
                            'monthly_amount', v_price);
end;
$$;

revoke all on function public.set_school_plan(uuid, text, text) from public, anon;
grant execute on function public.set_school_plan(uuid, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. HISOB-FAKTURA CHIQARISH
--
--  Summa `school_price()` dan olinadi va hisob-fakturaga MUZLATIB
--  yoziladi. Keyin filial qo'shilsa yoki narx o'zgarsa — bu hujjat
--  o'zgarmaydi.
-- ---------------------------------------------------------------------

create or replace function public.issue_subscription_invoice(
  p_school_id uuid,
  p_period    date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', coalesce(p_period, current_date))::date;
  v_price  jsonb;
  v_sub    public.school_subscriptions%rowtype;
  v_total  numeric;
  v_due    date;
  v_id     uuid;
begin
  -- Cron ham chaqiradi, super admin ham.
  if not (app.is_service_context() or app.is_platform_admin()) then
    raise exception 'Bu amal faqat platforma operatori uchun'
      using errcode = '42501';
  end if;

  -- Takror chiqarilmasin.
  select id into v_id
    from public.subscription_invoices
   where school_id = p_school_id and period = v_period and status <> 'void';
  if found then
    return jsonb_build_object('invoice_id', v_id, 'created', false,
                              'period', v_period);
  end if;

  v_price := public.school_price(p_school_id);

  select * into v_sub
    from public.school_subscriptions
   where school_id = p_school_id and status <> 'cancelled'
   limit 1;

  -- To'lov muddati: obunadagi sana, bo'lmasa oyning 5-sanasi.
  v_due := coalesce(v_sub.next_payment_date, v_period + 4);

  v_total := (v_price ->> 'monthly_total')::numeric
           + (v_price ->> 'setup_fee')::numeric;

  insert into public.subscription_invoices (
    school_id, period, due_date,
    setup_fee, base_amount,
    branches_count, branches_extra, branches_amount,
    students_count, students_included, students_extra_steps, students_amount,
    total_amount)
  values (
    p_school_id, v_period, v_due,
    (v_price ->> 'setup_fee')::numeric,
    (v_price ->> 'base_amount')::numeric,
    (v_price ->> 'branches_count')::int,
    (v_price ->> 'branches_extra')::int,
    (v_price ->> 'branches_amount')::numeric,
    (v_price ->> 'students_count')::int,
    (v_price ->> 'students_included')::int,
    (v_price ->> 'students_extra_steps')::int,
    (v_price ->> 'students_amount')::numeric,
    v_total)
  returning id into v_id;

  -- Obunadagi oylik summa hisob-faktura bilan bir xil bo'lib tursin.
  if v_sub.id is not null then
    update public.school_subscriptions
       set monthly_amount = (v_price ->> 'monthly_total')::numeric
     where id = v_sub.id;
  end if;

  perform app.plog('invoice_issued', 'subscription_invoices',
                   v_id::text, p_school_id, null,
                   jsonb_build_object('period', v_period, 'total', v_total));

  return jsonb_build_object('invoice_id', v_id, 'created', true,
                            'period', v_period, 'total', v_total,
                            'due_date', v_due, 'breakdown', v_price);
end;
$$;

revoke all on function public.issue_subscription_invoice(uuid, date) from public, anon;
grant execute on function public.issue_subscription_invoice(uuid, date)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. TO'LOVNI OBUNAGA QO'LLASH — ICHKI
--
--  To'lov ikki yo'l bilan keladi: maktab chek yuboradi va super
--  admin tasdiqlaydi, YOKI super admin bankdan ko'rib qo'lda
--  belgilaydi. Ikkalasi ham AYNAN shu funksiyaga tushadi — obuna
--  bir xil uzaytiriladi.
-- ---------------------------------------------------------------------

create or replace function app.apply_subscription_payment(
  p_school_id uuid,
  p_amount    numeric,
  p_paid_on   date,
  p_months    int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub    public.school_subscriptions%rowtype;
  v_left   numeric := p_amount;
  v_inv    record;
  v_apply  numeric;
  v_next   date;
begin
  select * into v_sub
    from public.school_subscriptions
   where school_id = p_school_id and status <> 'cancelled'
   limit 1;
  if not found then
    raise exception 'Maktabda faol obuna yo''q' using errcode = 'P0002';
  end if;

  -- --- Eng eski qarzdan boshlab yopamiz ----------------------------
  for v_inv in
    select * from public.subscription_invoices
     where school_id = p_school_id
       and status in ('unpaid', 'partial')
     order by period
  loop
    exit when v_left <= 0;
    v_apply := least(v_left, v_inv.total_amount - v_inv.paid_amount);

    update public.subscription_invoices
       set paid_amount = paid_amount + v_apply,
           status = case
             when paid_amount + v_apply >= total_amount then 'paid'::public.subscription_invoice_status
             else 'partial'::public.subscription_invoice_status
           end
     where id = v_inv.id;

    v_left := v_left - v_apply;
  end loop;

  -- --- Muddatni siljitamiz -----------------------------------------
  --  Asos — MAVJUD muddat, bugungi sana emas. Uch oy kechikkan
  --  maktab bir oylik to'lasa, u hali ham ikki oy qarzdor bo'lib
  --  qoladi: qarz kechirilmaydi.
  v_next := (coalesce(v_sub.next_payment_date, p_paid_on)
             + (p_months * interval '1 month'))::date;

  --  TO'LOV SINOVNI TUGATADI. Busiz `recompute` obunani hamon
  --  `trial` deb ko'radi (chunki `trial_ends_at` hali kelajakda) va
  --  pul to'lagan maktab "sinovda" bo'lib qolaveradi — hisob-faktura
  --  ham chiqarilmaydi, chunki cron sinovdagi maktabni o'tkazib
  --  yuboradi. Ya'ni bir marta to'lagan maktab boshqa hech qachon
  --  hisob olmaydi.
  update public.school_subscriptions
     set next_payment_date = v_next,
         last_paid_at      = p_paid_on,
         status = case
           when status = 'trial' then 'active'::public.subscription_status
           else status
         end
   where id = v_sub.id;

  return jsonb_build_object(
    'school_id',         p_school_id,
    'next_payment_date', v_next,
    'unapplied',         v_left,
    -- Holat zinapoyasi qayta hisoblanadi: yangi muddat kelajakda
    -- bo'lsa maktab shu yerda `active` ga qaytadi.
    'billing',           app.recompute_school_billing(p_school_id));
end;
$$;

revoke all on function app.apply_subscription_payment(uuid, numeric, date, int)
  from public, anon, authenticated;
grant execute on function app.apply_subscription_payment(uuid, numeric, date, int)
  to service_role;

-- ---------------------------------------------------------------------
-- 8. SUPER ADMIN QO'LDA TO'LOV BELGILAYDI (TZ M3)
-- ---------------------------------------------------------------------

create or replace function public.record_subscription_payment(
  p_school_id uuid,
  p_amount    numeric,
  p_paid_on   date default current_date,
  p_months    int  default 1,
  p_note      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := app.require_platform_admin();
  v_pay   uuid;
  v_res   jsonb;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Summa noldan katta bo''lishi kerak' using errcode = '22023';
  end if;
  if p_months < 1 or p_months > 24 then
    raise exception 'Oylar soni 1 dan 24 gacha bo''lishi kerak' using errcode = '22023';
  end if;

  -- Qo'lda belgilangan to'lov ham CHEK JADVALIGA tushadi: maktab uni
  -- o'z panelida ko'rsin, "pulni to'ladim, tizimda yo'q" degan nizo
  -- chiqmasin.
  insert into public.subscription_payments
    (school_id, amount, paid_on, months, method, note,
     status, reviewed_by, reviewed_at)
  values
    (p_school_id, p_amount, p_paid_on, p_months, 'bank',
     coalesce(p_note, 'Platforma operatori qo''lda belgiladi'),
     'confirmed', v_admin, now())
  returning id into v_pay;

  v_res := app.apply_subscription_payment(p_school_id, p_amount, p_paid_on, p_months);

  perform app.plog('payment_recorded', 'subscription_payments',
                   v_pay::text, p_school_id, null,
                   jsonb_build_object('amount', p_amount, 'months', p_months,
                                      'paid_on', p_paid_on, 'admin_id', v_admin));

  return v_res || jsonb_build_object('payment_id', v_pay);
end;
$$;

revoke all on function public.record_subscription_payment(uuid, numeric, date, int, text)
  from public, anon;
grant execute on function public.record_subscription_payment(uuid, numeric, date, int, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. MAKTAB CHEK YUBORADI
--
--  Bu YAGONA funksiya maktab foydalanuvchisi chaqiradi. Bloklangan
--  maktab ham chaqira olishi SHART — aks holda to'lovni bildirish
--  yo'li qolmaydi. Shuning uchun `app.may_write` tekshirilmaydi.
-- ---------------------------------------------------------------------

create or replace function public.submit_subscription_payment(
  p_amount    numeric,
  p_paid_on   date,
  p_months    int  default 1,
  p_method    text default 'bank',
  p_file_path text default null,
  p_note      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school uuid := app.school_id();
  v_user   uuid := (select auth.uid());
  v_id     uuid;
  v_thread uuid;
begin
  if v_school is null then
    raise exception 'Maktab konteksti topilmadi' using errcode = '42501';
  end if;

  -- Faqat direktor darajasidagi huquq. Buxgalter obuna to'lovini
  -- yubormaydi — bu maktab bilan ijrochi o'rtasidagi shartnoma.
  if not app.can('users.manage') then
    raise exception 'Obuna to''lovini yuborish huquqi yo''q'
      using errcode = '42501';
  end if;

  -- Texnik yordam sessiyasida o'qish rejimida — yo'q.
  if app.is_readonly_session() then
    raise exception 'Faqat o''qish rejimida yozib bo''lmaydi'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Summa noldan katta bo''lishi kerak' using errcode = '22023';
  end if;
  if p_paid_on > current_date then
    raise exception 'To''lov sanasi kelajakda bo''lishi mumkin emas'
      using errcode = '22023';
  end if;
  if p_months < 1 or p_months > 24 then
    raise exception 'Oylar soni 1 dan 24 gacha bo''lishi kerak' using errcode = '22023';
  end if;

  insert into public.subscription_payments
    (school_id, amount, paid_on, months, method, file_path, note,
     status, submitted_by)
  values
    (v_school, p_amount, p_paid_on, p_months, p_method, p_file_path,
     p_note, 'pending', v_user)
  returning id into v_id;

  -- Chek bilan birga yozishma mavzusi ochiladi: super admin savol
  -- bersa yozadigan joyi bo'lsin, maktab esa javobni ko'rsin.
  insert into public.support_threads
    (school_id, subject, opened_by, opened_by_platform, payment_id, priority)
  values
    (v_school, 'Obuna to''lovi — ' || to_char(p_paid_on, 'DD.MM.YYYY'),
     v_user, false, v_id, 'normal')
  returning id into v_thread;

  perform app.support_post(
    v_thread, v_school, v_user, false,
    'To''lov cheki yuborildi. Summa: ' || trim(to_char(p_amount, '999G999G999'))
      || '. Sana: ' || to_char(p_paid_on, 'DD.MM.YYYY')
      || '. Davr: ' || p_months || ' oy.',
    p_file_path, true);

  perform app.plog('payment_submitted', 'subscription_payments',
                   v_id::text, v_school, null,
                   jsonb_build_object('amount', p_amount, 'paid_on', p_paid_on,
                                      'months', p_months));

  return jsonb_build_object('payment_id', v_id, 'thread_id', v_thread,
                            'status', 'pending');
end;
$$;

comment on function public.submit_subscription_payment(numeric, date, int, text, text, text) is
  'Maktab obuna to''lovi chekini yuboradi. Yozuv `pending` — obunaga '
  'TA''SIR QILMAYDI. Bloklangan maktab ham chaqira oladi.';

revoke all on function public.submit_subscription_payment(numeric, date, int, text, text, text)
  from public, anon;
grant execute on function public.submit_subscription_payment(numeric, date, int, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 10. SUPER ADMIN CHEKNI KO'RIB CHIQADI
-- ---------------------------------------------------------------------

create or replace function public.review_subscription_payment(
  p_payment_id uuid,
  p_approve    boolean,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := app.require_platform_admin();
  v_pay   public.subscription_payments%rowtype;
  v_res   jsonb := '{}'::jsonb;
  v_thread uuid;
  v_text  text;
begin
  select * into v_pay from public.subscription_payments where id = p_payment_id;
  if not found then
    raise exception 'To''lov topilmadi' using errcode = 'P0002';
  end if;
  if v_pay.status <> 'pending' then
    raise exception 'Bu to''lov allaqachon ko''rib chiqilgan (%)', v_pay.status
      using errcode = '22023';
  end if;

  if not p_approve and (p_reason is null or length(btrim(p_reason)) < 5) then
    raise exception 'Rad etish sababi ko''rsatilishi shart (kamida 5 belgi)'
      using errcode = '22023';
  end if;

  -- Enum ustuniga `case` yozilganda tur ANIQ ko'rsatilishi shart:
  -- shoxlaridagi literal `text` deb olinadi va Postgres 42804 beradi.
  update public.subscription_payments
     set status        = (case when p_approve then 'confirmed' else 'rejected' end)
                           ::public.subscription_payment_status,
         reviewed_by   = v_admin,
         reviewed_at   = now(),
         reject_reason = case when p_approve then null else btrim(p_reason) end
   where id = p_payment_id;

  if p_approve then
    v_res := app.apply_subscription_payment(
               v_pay.school_id, v_pay.amount, v_pay.paid_on, v_pay.months);
    v_text := 'To''lov tasdiqlandi. Obuna '
              || (v_res ->> 'next_payment_date') || ' gacha uzaytirildi.';
  else
    v_text := 'To''lov rad etildi. Sabab: ' || btrim(p_reason);
  end if;

  -- Maktabga xabar — yozishma orqali. Chek bilan ochilgan mavzu bo'lsa
  -- o'shanga, bo'lmasa yangisi ochiladi.
  select id into v_thread
    from public.support_threads
   where payment_id = p_payment_id
   order by created_at
   limit 1;

  if v_thread is null then
    insert into public.support_threads
      (school_id, subject, opened_by, opened_by_platform, payment_id)
    values
      (v_pay.school_id, 'Obuna to''lovi', v_admin, true, p_payment_id)
    returning id into v_thread;
  end if;

  perform app.support_post(v_thread, v_pay.school_id, v_admin, true,
                           v_text, null, true);

  perform app.plog(
    case when p_approve then 'payment_approved' else 'payment_rejected' end,
    'subscription_payments', p_payment_id::text, v_pay.school_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', case when p_approve then 'confirmed' else 'rejected' end,
                       'amount', v_pay.amount, 'reason', btrim(coalesce(p_reason, '')),
                       'admin_id', v_admin));

  return v_res || jsonb_build_object('payment_id', p_payment_id,
                                     'approved', p_approve,
                                     'thread_id', v_thread);
end;
$$;

revoke all on function public.review_subscription_payment(uuid, boolean, text)
  from public, anon;
grant execute on function public.review_subscription_payment(uuid, boolean, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 11. NARX PARAMETRINI O'ZGARTIRISH
--
--  Narx o'zgarishi — pul bilan bog'liq qaror. Jurnalsiz bo'lmaydi.
-- ---------------------------------------------------------------------

create or replace function public.set_platform_setting(
  p_key    text,
  p_value  jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := app.require_platform_admin();
  v_old   jsonb;
begin
  select value into v_old from public.platform_settings where key = p_key;
  if not found then
    raise exception 'Sozlama topilmadi: %', p_key using errcode = 'P0002';
  end if;

  update public.platform_settings set value = p_value where key = p_key;

  perform app.plog('setting_changed', 'platform_settings', p_key, null,
                   jsonb_build_object('value', v_old),
                   jsonb_build_object('value', p_value,
                                      'reason', btrim(coalesce(p_reason, '')),
                                      'admin_id', v_admin));

  return jsonb_build_object('key', p_key, 'value', p_value);
end;
$$;

revoke all on function public.set_platform_setting(text, jsonb, text) from public, anon;
grant execute on function public.set_platform_setting(text, jsonb, text)
  to authenticated, service_role;
