-- =====================================================================
--  45 — PLATFORMA HISOBOTLARI (TZ M4)
--
--  ASOSIY TAMOYIL (TZ 2.1): super admin MIJOZ MA'LUMOTINI KO'RMAYDI.
--  Bu funksiyalar faqat JAMLANGAN raqam qaytaradi — nechta o'quvchi,
--  nechta filial, qancha qarz. O'quvchi ismi, ota-ona telefoni,
--  bironta to'lov summasi bu yerdan CHIQMAYDI.
--
--  Maktabning ichki moliyasini ko'rish uchun yagona yo'l — texnik
--  yordam sessiyasi, u esa ikkita jurnalga tushadi va direktorga
--  ko'rinadi.
--
--  NEGA `security definer`: super admin `students` va `audit_log` ni
--  RLS orqali ham ko'ra oladi (`or app.is_platform_admin()`), lekin
--  53 ta jadvalni sanash uchun panel o'nlab so'rov yuborishi kerak
--  bo'lardi. Bitta funksiya — bitta so'rov.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MAKTABLAR RO'YXATI (E1 ekrani)
-- ---------------------------------------------------------------------

create or replace function public.platform_schools()
returns table (
  school_id           uuid,
  name                text,
  tax_id              text,
  phone               text,
  status              public.school_status,
  created_at          timestamptz,

  plan_code           text,
  plan_name           text,
  max_students        integer,
  max_branches        integer,

  subscription_status public.subscription_status,
  monthly_amount      numeric,
  trial_ends_at       date,
  next_payment_date   date,
  last_paid_at        date,
  overdue_days        integer,

  students_count      integer,
  branches_count      integer,
  users_count         integer,
  teachers_count      integer,
  students_included   integer,
  over_limit          boolean,

  unpaid_amount       numeric,
  pending_payments    integer,
  unread_messages     integer,
  last_activity       timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_per_branch int := coalesce(app.billing_num('billing.students_per_branch'), 250)::int;
begin
  if not app.is_platform_admin() then
    raise exception 'Bu amal faqat platforma operatori uchun'
      using errcode = '42501';
  end if;

  return query
  select
    s.id, s.name, s.tax_id, s.phone, s.status, s.created_at,

    p.code, p.name, p.max_students, p.max_branches,

    sub.status, sub.monthly_amount, sub.trial_ends_at,
    sub.next_payment_date, sub.last_paid_at,
    case when sub.next_payment_date is null then null
         else (current_date - sub.next_payment_date) end,

    cnt.students, cnt.branches, cnt.users, cnt.teachers,
    cnt.branches * v_per_branch,
    -- Sotuv signali (TZ E1): o'quvchi soni filiallar bergan limitdan
    -- yoki tarif chegarasidan oshgan.
    (cnt.students > cnt.branches * v_per_branch)
      or (p.max_students is not null and cnt.students > p.max_students),

    coalesce(bill.unpaid, 0), coalesce(bill.pending, 0),
    coalesce(msg.unread, 0), act.last_at
  from public.schools s
  left join public.school_subscriptions sub
         on sub.school_id = s.id and sub.status <> 'cancelled'
  left join public.plans p on p.id = sub.plan_id

  -- O'lcham. Har biri alohida `count` — bitta `join` bilan qilinsa
  -- dekart ko'paytmasi chiqadi va sonlar bir necha barobar oshadi.
  left join lateral (
    select
      (select count(*)::int from public.students st
        where st.school_id = s.id and st.status = 'active' and st.deleted_at is null) as students,
      (select count(*)::int from public.branches b
        where b.school_id = s.id and b.is_active and b.deleted_at is null) as branches,
      (select count(*)::int from public.app_users u
        where u.school_id = s.id and u.is_active and u.deleted_at is null) as users,
      (select count(*)::int from public.teachers t
        where t.school_id = s.id and t.is_active and t.deleted_at is null) as teachers
  ) cnt on true

  left join lateral (
    select
      sum(i.total_amount - i.paid_amount) filter (
        where i.status in ('unpaid', 'partial')) as unpaid,
      (select count(*)::int from public.subscription_payments sp
        where sp.school_id = s.id and sp.status = 'pending') as pending
    from public.subscription_invoices i
    where i.school_id = s.id
  ) bill on true

  left join lateral (
    select count(*)::int as unread
      from public.support_threads th
      join public.support_messages m on m.thread_id = th.id
     where th.school_id = s.id
       and not m.from_platform
       and (th.platform_read_at is null or m.created_at > th.platform_read_at)
  ) msg on true

  -- Oxirgi faollik — audit jurnalining oxirgi yozuvi. Indeks
  -- (school_id, at desc) borligi uchun bu arzon so'rov.
  left join lateral (
    select max(a.at) as last_at
      from public.audit_log a
     where a.school_id = s.id
  ) act on true

  where s.deleted_at is null
  order by s.name;
end;
$$;

comment on function public.platform_schools() is
  'TZ E1 — maktablar ro''yxati: holat, o''lcham, obuna, qarz. '
  'Faqat JAMLANGAN raqamlar, mijoz mazmuni yo''q.';

revoke all on function public.platform_schools() from public, anon;
grant execute on function public.platform_schools() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. UMUMIY KO'RSATKICHLAR (E7 ekrani)
-- ---------------------------------------------------------------------

create or replace function public.platform_overview()
returns table (
  schools_total      integer,
  schools_trial      integer,
  schools_active     integer,
  schools_restricted integer,
  schools_suspended  integer,
  schools_archived   integer,

  mrr                numeric,
  unpaid_amount      numeric,
  unpaid_invoices    integer,
  overdue_schools    integer,

  students_total     integer,
  branches_total     integer,
  users_total        integer,

  pending_payments   integer,
  open_threads       integer,
  unread_threads     integer,

  new_schools_30d    integer,
  churn_90d          integer,
  failed_messages    integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Bu amal faqat platforma operatori uchun'
      using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::int from public.schools where deleted_at is null),
    (select count(*)::int from public.schools where deleted_at is null and status = 'trial'),
    (select count(*)::int from public.schools where deleted_at is null and status = 'active'),
    (select count(*)::int from public.schools where deleted_at is null and status = 'restricted'),
    (select count(*)::int from public.schools where deleted_at is null and status = 'suspended'),
    (select count(*)::int from public.schools where deleted_at is null and status = 'archived'),

    -- Oylik takrorlanuvchi daromad. Sinov va to'xtatilgan maktablar
    -- KIRMAYDI — ular hozir pul keltirmayapti.
    (select coalesce(sum(sub.monthly_amount), 0)
       from public.school_subscriptions sub
       join public.schools s on s.id = sub.school_id
      where s.deleted_at is null
        and sub.status in ('active', 'grace')),

    (select coalesce(sum(total_amount - paid_amount), 0)
       from public.subscription_invoices
      where status in ('unpaid', 'partial')),
    (select count(*)::int from public.subscription_invoices
      where status in ('unpaid', 'partial')),
    (select count(*)::int
       from public.school_subscriptions sub
       join public.schools s on s.id = sub.school_id
      where s.deleted_at is null
        and sub.status <> 'cancelled'
        and sub.next_payment_date is not null
        and sub.next_payment_date < current_date),

    (select count(*)::int from public.students
      where status = 'active' and deleted_at is null),
    (select count(*)::int from public.branches
      where is_active and deleted_at is null),
    (select count(*)::int from public.app_users
      where is_active and deleted_at is null),

    (select count(*)::int from public.subscription_payments where status = 'pending'),
    (select count(*)::int from public.support_threads where status <> 'closed'),
    (select count(distinct th.id)::int
       from public.support_threads th
       join public.support_messages m on m.thread_id = th.id
      where not m.from_platform
        and (th.platform_read_at is null or m.created_at > th.platform_read_at)),

    (select count(*)::int from public.schools
      where deleted_at is null and created_at >= now() - interval '30 days'),
    -- Chiqib ketganlar: oxirgi 90 kunda arxivga o'tganlar.
    (select count(*)::int from public.schools
      where status = 'archived' and updated_at >= now() - interval '90 days'),
    (select count(*)::int from public.message_queue
      where status in ('failed', 'blocked'));
end;
$$;

comment on function public.platform_overview() is
  'TZ E7 — platforma ko''rsatkichlari: maktablar, daromad, qarz, '
  'yuk. Bitta qator.';

revoke all on function public.platform_overview() from public, anon;
grant execute on function public.platform_overview() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. DAROMAD DINAMIKASI (E7 grafigi)
--
--  Hisob-fakturalar bo'yicha: qancha chiqarilgan va qancha
--  yig'ilgan. Yig'ilgan summa TASDIQLANGAN cheklardan olinadi —
--  `pending` chek daromad emas.
-- ---------------------------------------------------------------------

create or replace function public.platform_revenue(p_months int default 12)
returns table (
  period    date,
  issued    numeric,
  collected numeric,
  invoices  integer,
  schools   integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Bu amal faqat platforma operatori uchun'
      using errcode = '42501';
  end if;

  -- DIQQAT: chiqish ustunlari (`period`, `schools`) jadval ustunlari
  -- bilan bir xil nomlanadi. plpgsql ularni O'ZGARUVCHI deb oladi va
  -- `column reference "period" is ambiguous` (42702) chiqadi.
  -- Shuning uchun har bir jadvalga taxallus berilgan va ichkarida
  -- HAMMA ustun to'liq nom bilan yoziladi.
  return query
  with months as (
    select generate_series(
             date_trunc('month', current_date) - ((p_months - 1) * interval '1 month'),
             date_trunc('month', current_date),
             interval '1 month')::date as m_period
  )
  select
    m.m_period,
    coalesce(i.issued, 0),
    coalesce(pay.collected, 0),
    coalesce(i.cnt, 0),
    coalesce(i.school_cnt, 0)
  from months m
  left join lateral (
    select sum(si.total_amount)              as issued,
           count(*)::int                     as cnt,
           count(distinct si.school_id)::int as school_cnt
      from public.subscription_invoices si
     where si.status <> 'void' and si.period = m.m_period
  ) i on true
  left join lateral (
    select sum(sp.amount) as collected
      from public.subscription_payments sp
     where sp.status = 'confirmed'
       and date_trunc('month', sp.paid_on)::date = m.m_period
  ) pay on true
  order by m.m_period;
end;
$$;

revoke all on function public.platform_revenue(int) from public, anon;
grant execute on function public.platform_revenue(int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. BITTA MAKTAB KARTOCHKASI (E2 ekrani)
--
--  Sanalar va sonlar — summalar emas (TZ E2: "sanalar, summalar
--  emas"). Faqat OBUNA summasi ko'rsatiladi, u ijrochining o'z puli.
-- ---------------------------------------------------------------------

create or replace function public.platform_school_card(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Bu amal faqat platforma operatori uchun'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'school', jsonb_build_object(
      'id', s.id, 'name', s.name, 'legal_name', s.legal_name,
      'tax_id', s.tax_id, 'address', s.address, 'phone', s.phone,
      'email', s.email, 'status', s.status, 'timezone', s.timezone,
      'default_lang', s.default_lang, 'created_at', s.created_at),

    'size', jsonb_build_object(
      'students', (select count(*) from public.students
                    where school_id = s.id and status = 'active' and deleted_at is null),
      'students_all', (select count(*) from public.students
                    where school_id = s.id and deleted_at is null),
      'branches', (select count(*) from public.branches
                    where school_id = s.id and is_active and deleted_at is null),
      'users',    (select count(*) from public.app_users
                    where school_id = s.id and is_active and deleted_at is null),
      'teachers', (select count(*) from public.teachers
                    where school_id = s.id and is_active and deleted_at is null),
      'classes',  (select count(*) from public.classes
                    where school_id = s.id and is_active and deleted_at is null)),

    -- FAQAT SANALAR. Summalar ataylab yo'q (TZ E2).
    'activity', jsonb_build_object(
      'last_audit',   (select max(at) from public.audit_log where school_id = s.id),
      'last_invoice', (select max(created_at) from public.invoices where school_id = s.id),
      'last_payment', (select max(created_at) from public.payments where school_id = s.id),
      'last_sign_in', (select max(au.last_sign_in_at)
                         from public.app_users u
                         join auth.users au on au.id = u.id
                        where u.school_id = s.id)),

    'price', public.school_price(s.id),

    'director', (
      select jsonb_build_object('id', u.id, 'full_name', u.full_name,
                                'email', u.email, 'phone', u.phone)
        from public.app_users u
       where u.school_id = s.id and u.role = 'director'
         and u.is_active and u.deleted_at is null
       order by u.created_at limit 1)
  )
  into v
  from public.schools s
  where s.id = p_school_id;

  if v is null then
    raise exception 'Maktab topilmadi' using errcode = 'P0002';
  end if;

  return v;
end;
$$;

revoke all on function public.platform_school_card(uuid) from public, anon;
grant execute on function public.platform_school_card(uuid) to authenticated, service_role;
