-- =====================================================================
--  39 — PLATFORMA: NARX MODELI VA OBUNA HISOB-FAKTURASI
--
--  MUAMMO: `plans` jadvali qat'iy tarif beradi — "Asosiy 500 000,
--  300 o'quvchi". Amalda narx maktabning O'LCHAMIGA qarab o'sadi:
--  yangi filial ochilsa yoki o'quvchi ko'paysa summa o'zgaradi.
--  Har bir kombinatsiya uchun alohida tarif yaratish — yuzlab qator.
--
--  YECHIM: narx FORMULA bilan hisoblanadi, formula parametrlari esa
--  `platform_settings` da turadi. Narx o'zgarganda migratsiya emas,
--  bitta qator yangilanadi.
--
--    oylik = asos
--          + (filial − 1) × filial_narxi
--          + ceil(max(0, o'quvchi − filial × 250) / 50) × qadam_narxi
--
--  Har bir filial 250 o'quvchi limitini BERADI — ya'ni 2 filialli
--  maktabda 500 o'quvchigacha qo'shimcha to'lov yo'q.
--
--  MISOL (standart narxlarda):
--    1 filial, 200 o'quvchi  → 500 000
--    1 filial, 320 o'quvchi  → 500 000 + 2×50 000          =   600 000
--    2 filial, 600 o'quvchi  → 500 000 + 450 000 + 2×50 000 = 1 050 000
--
--  Bir martalik ulanish to'lovi — 600 000 — birinchi hisob-fakturaga
--  qo'shiladi va boshqa hech qachon takrorlanmaydi.
--
--  NEGA HISOB-FAKTURA JADVALI KERAK: `school_subscriptions` da faqat
--  joriy holat bor. "O'tgan may oyida qancha hisoblangan edi" degan
--  savolga javob yo'q. Hisob-faktura — o'zgarmas hujjat: chiqarilgan
--  paytdagi filial soni, o'quvchi soni va narxlar unda MUZLATILADI.
--  Keyin narx o'zgarsa ham eski hisob-faktura o'zgarmaydi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLATFORMA SOZLAMALARI
--
--  Maktab sozlamalari `school_settings` da, platformaniki shu yerda.
--  `is_public` — maktab ham ko'radigan qiymat. Narxlar ochiq bo'lishi
--  KERAK: direktor nima uchun qancha to'layotganini ko'rsin.
-- ---------------------------------------------------------------------

create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb       not null,
  note       text,
  is_public  boolean     not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.platform_settings is
  'Platforma darajasidagi sozlamalar (narx formulasi, bloklash '
  'muddatlari). Yozish siyosati YO''Q — faqat RPC orqali.';
comment on column public.platform_settings.is_public is
  'true — maktab ham o''qiy oladi. Narx parametrlari ochiq: direktor '
  'hisob-fakturani mustaqil tekshira olishi kerak.';

insert into public.platform_settings (key, value, note, is_public) values
  ('billing.setup_fee',           to_jsonb(600000), 'Bir martalik ulanish to''lovi', true),
  ('billing.base_monthly',        to_jsonb(500000), 'Asosiy oylik (1 filial, 250 o''quvchi)', true),
  ('billing.branch_price',        to_jsonb(450000), 'Har qo''shimcha filial uchun oylik', true),
  ('billing.students_per_branch', to_jsonb(250),    'Bitta filial beradigan o''quvchi limiti', true),
  ('billing.student_step',        to_jsonb(50),     'Limitdan oshgan o''quvchilar qadami', true),
  ('billing.student_step_price',  to_jsonb(50000),  'Har qadam uchun qo''shimcha oylik', true),
  ('billing.grace_days',          to_jsonb(15),     'Muddatdan keyin necha kunda faqat o''qishga o''tadi', true),
  ('billing.suspend_days',        to_jsonb(45),     'Muddatdan keyin necha kunda butunlay bloklanadi', true),
  ('billing.invoice_lead_days',   to_jsonb(5),      'Hisob-faktura muddatdan necha kun oldin chiqariladi', false),
  ('billing.currency',            to_jsonb('UZS'::text),  'Valyuta', true)
on conflict (key) do nothing;

select app.attach_touch_trigger('platform_settings');

-- Bitta parametrni son sifatida o'qish. Barcha hisob shu orqali —
-- kalit nomi bir joyda xato yozilsa darhol ko'rinadi.
create or replace function app.billing_num(p_key text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (value #>> '{}')::numeric
    from public.platform_settings
   where key = p_key;
$$;

comment on function app.billing_num(text) is
  'Narx parametrini son sifatida qaytaradi. Kalit topilmasa null — '
  'chaqiruvchi coalesce bilan zaxira qiymat beradi.';

revoke all on function app.billing_num(text) from public, anon;
grant execute on function app.billing_num(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. OBUNA HISOB-FAKTURASI
-- ---------------------------------------------------------------------

create table if not exists public.subscription_invoices (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete restrict,
  -- Qaysi oy uchun. Har doim oyning 1-sanasi.
  period        date not null,
  issued_on     date not null default current_date,
  due_date      date not null,

  -- --- Summa tarkibi. Chiqarilgan paytdagi holat MUZLATILADI -------
  setup_fee            numeric(14,2) not null default 0 check (setup_fee >= 0),
  base_amount          numeric(14,2) not null default 0 check (base_amount >= 0),
  branches_count       integer       not null default 1,
  branches_extra       integer       not null default 0,
  branches_amount      numeric(14,2) not null default 0 check (branches_amount >= 0),
  students_count       integer       not null default 0,
  students_included    integer       not null default 0,
  students_extra_steps integer       not null default 0,
  students_amount      numeric(14,2) not null default 0 check (students_amount >= 0),
  total_amount         numeric(14,2) not null check (total_amount >= 0),
  paid_amount          numeric(14,2) not null default 0 check (paid_amount >= 0),

  status     public.subscription_invoice_status not null default 'unpaid',
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscription_invoices is
  'Maktabga chiqarilgan oylik hisob-faktura. O''CHIRILMAYDI — xato '
  'chiqarilgani `void` bilan bekor qilinadi (TZ 5.4.8).';
comment on column public.subscription_invoices.period is
  'Qaysi oy uchun. Oyning 1-sanasi.';
comment on column public.subscription_invoices.students_included is
  'Filiallar bergan bepul limit = filial × billing.students_per_branch.';

-- Bir oyga bitta amaldagi hisob-faktura. Bekor qilinganlari cheklanmaydi.
create unique index if not exists subscription_invoices_period_idx
  on public.subscription_invoices(school_id, period)
  where status <> 'void';

create index if not exists subscription_invoices_due_idx
  on public.subscription_invoices(due_date)
  where status in ('unpaid', 'partial');

create index if not exists subscription_invoices_school_idx
  on public.subscription_invoices(school_id, period desc);

select app.attach_touch_trigger('subscription_invoices');

-- ---------------------------------------------------------------------
-- 3. MAKTAB YUBORGAN TO'LOV CHEKI
--
--  Direktor bank chekining rasmini yuklaydi. Yozuv `pending` holatda
--  tug'iladi va obunaga TA'SIR QILMAYDI — super admin tasdiqlamaguncha
--  maktab hech narsa yutmaydi. Bu ota-ona cheki bilan bir xil qoida
--  (TZ 4.7.3): tasdiqlanmagan chek qarzni yopmaydi.
-- ---------------------------------------------------------------------

create table if not exists public.subscription_payments (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete restrict,
  invoice_id    uuid references public.subscription_invoices(id) on delete set null,
  amount        numeric(14,2) not null check (amount > 0),
  paid_on       date not null,
  -- Necha oylik to'lov. Tasdiqlanganda next_payment_date shuncha siljiydi.
  months        smallint not null default 1 check (months between 1 and 24),
  method        text not null default 'bank'
                check (method in ('bank', 'cash', 'card', 'other')),
  -- storage: subscription-receipts / {school_id}/{yil}/{fayl}
  file_path     text,
  note          text,

  status        public.subscription_payment_status not null default 'pending',
  submitted_by  uuid,          -- app_users.id — chekni yuborgan direktor
  reviewed_by   uuid references public.platform_admins(id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint subscription_payment_reject_needs_reason
    check (status <> 'rejected'
           or (reject_reason is not null and length(btrim(reject_reason)) >= 5))
);

comment on table public.subscription_payments is
  'Maktab yuborgan obuna to''lovi va uning cheki. `pending` holat '
  'obunani UZAYTIRMAYDI — faqat super admin tasdig''i uzaytiradi.';
comment on column public.subscription_payments.months is
  'Necha oyga to''lov. Tasdiqlanganda next_payment_date shuncha oy siljiydi.';

create index if not exists subscription_payments_pending_idx
  on public.subscription_payments(created_at desc)
  where status = 'pending';

create index if not exists subscription_payments_school_idx
  on public.subscription_payments(school_id, created_at desc);

select app.attach_touch_trigger('subscription_payments');

-- ---------------------------------------------------------------------
-- 4. NARX HISOBI
--
--  Bitta manba. Panel ham, hisob-faktura chiqaruvchi cron ham,
--  super admin ham AYNAN shu funksiyani chaqiradi — shuning uchun
--  ko'rsatilgan narx bilan hisoblangan narx hech qachon farq qilmaydi.
-- ---------------------------------------------------------------------

create or replace function public.school_price(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base        numeric := coalesce(app.billing_num('billing.base_monthly'), 500000);
  v_branch      numeric := coalesce(app.billing_num('billing.branch_price'), 450000);
  v_per_branch  int     := coalesce(app.billing_num('billing.students_per_branch'), 250)::int;
  v_step        int     := coalesce(app.billing_num('billing.student_step'), 50)::int;
  v_step_price  numeric := coalesce(app.billing_num('billing.student_step_price'), 50000);
  v_setup       numeric := coalesce(app.billing_num('billing.setup_fee'), 600000);

  v_branches    int;
  v_students    int;
  v_included    int;
  v_extra       int;
  v_steps       int;
  v_first       boolean;
begin
  -- Maktab o'zining narxini ko'ra oladi, super admin — hammasini.
  if not (app.is_platform_admin()
          or app.is_service_context()
          or p_school_id = app.school_id()) then
    raise exception 'Bu maktab narxini ko''rish huquqi yo''q'
      using errcode = '42501';
  end if;

  select count(*) into v_branches
    from public.branches
   where school_id = p_school_id and is_active and deleted_at is null;

  select count(*) into v_students
    from public.students
   where school_id = p_school_id and status = 'active' and deleted_at is null;

  -- Filialsiz maktab bo'lmaydi, lekin nolga bo'lish xavfini yopamiz.
  v_branches := greatest(v_branches, 1);

  v_included := v_branches * v_per_branch;
  v_extra    := greatest(0, v_students - v_included);
  v_steps    := ceil(v_extra::numeric / v_step)::int;

  -- Ulanish to'lovi faqat BIRINCHI hisob-fakturada.
  select not exists (
    select 1 from public.subscription_invoices
     where school_id = p_school_id and status <> 'void'
  ) into v_first;

  return jsonb_build_object(
    'school_id',            p_school_id,
    'branches_count',       v_branches,
    'branches_extra',       v_branches - 1,
    'branches_amount',      (v_branches - 1) * v_branch,
    'students_count',       v_students,
    'students_included',    v_included,
    'students_extra',       v_extra,
    'students_extra_steps', v_steps,
    'students_amount',      v_steps * v_step_price,
    'base_amount',          v_base,
    'monthly_total',        v_base + (v_branches - 1) * v_branch + v_steps * v_step_price,
    'setup_fee',            case when v_first then v_setup else 0 end,
    'is_first_invoice',     v_first,
    'params', jsonb_build_object(
      'base_monthly',        v_base,
      'branch_price',        v_branch,
      'students_per_branch', v_per_branch,
      'student_step',        v_step,
      'student_step_price',  v_step_price,
      'setup_fee',           v_setup)
  );
end;
$$;

comment on function public.school_price(uuid) is
  'Maktabning joriy o''lchamiga qarab oylik narxni hisoblaydi. '
  'Panel va hisob-faktura chiqaruvchi cron uchun YAGONA manba.';

revoke all on function public.school_price(uuid) from public, anon;
grant execute on function public.school_price(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. CHEK RASMLARI UCHUN BUCKET
--
--  Yopiq. Maktab faqat O'Z papkasiga yozadi va o'qiydi; super admin
--  service_role orqali ko'radi (storage siyosatida `is_platform_admin`
--  ishlatilmaydi — platforma adminida `app_users` yozuvi yo'q va
--  `app.school_id()` null qaytaradi).
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('subscription-receipts', 'subscription-receipts', false, 10485760,
        array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists subscription_receipts_read on storage.objects;
create policy subscription_receipts_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'subscription-receipts'
    and (storage.foldername(name))[1] = (select app.school_id())::text
  );

-- Bloklangan maktab ham chek YUKLAY OLISHI kerak — aks holda to'lovni
-- isbotlash yo'li qolmaydi. Shuning uchun bu yerda `app.may_write`
-- EMAS, faqat huquq tekshiriladi.
drop policy if exists subscription_receipts_write on storage.objects;
create policy subscription_receipts_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'subscription-receipts'
    and (storage.foldername(name))[1] = (select app.school_id())::text
    and (select app.can('users.manage'))
  );
