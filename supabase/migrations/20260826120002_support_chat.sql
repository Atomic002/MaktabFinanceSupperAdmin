-- =====================================================================
--  40 — MAKTAB ↔ SUPER ADMIN YOZISHMASI
--
--  MUAMMO: bugungi kunda maktab bilan ijrochi o'rtasida hech qanday
--  kanal yo'q. Direktor savol bersa — Telegram yoki telefon. U yerda
--  hech narsa saqlanmaydi: kim nima va'da qilgani, qachon aytilgani
--  bir haftadan keyin isbotlab bo'lmaydi. To'lov va bloklash bilan
--  bog'liq nizolarda bu jiddiy muammo.
--
--  YECHIM: tizim ICHIDA mavzuli yozishma. Har bir xabar maktabga ham,
--  ijrochiga ham ko'rinadi va o'chirilmaydi.
--
--  NEGA `message_queue` EMAS: u bir tomonlama — maktabdan ota-onaga
--  Telegram xabari. Bu yerda ikki tomonlama suhbat kerak, qabul
--  qiluvchisi Telegram emas, panelning o'zi.
--
--  MUHIM: bloklangan (`suspended`) maktab ham bu bo'limga KIRA OLADI.
--  Aks holda to'lov muammosini hal qilish yo'li qolmaydi — odam
--  bloklangan, gaplashib ham bo'lmaydi degan holat kelib chiqadi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MAVZU
--
--  O'qilganlik ikki tomonlama SANA bilan yuritiladi: `school_read_at`
--  va `platform_read_at`. Har bir xabar uchun alohida "o'qildi"
--  yozuvidan ko'ra soddaroq va yetarli — bizga faqat "yangi bormi"
--  degan savolga javob kerak.
-- ---------------------------------------------------------------------

create table if not exists public.support_threads (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete restrict,
  subject     text not null check (length(btrim(subject)) >= 3),
  status      public.support_thread_status not null default 'open',
  priority    public.support_priority      not null default 'normal',

  -- Kim ochgan. Platforma ochgan bo'lsa `opened_by_platform` = true.
  opened_by            uuid,
  opened_by_platform   boolean not null default false,

  -- Obuna to'lovi bilan bog'liq mavzu bo'lsa — havola.
  payment_id  uuid references public.subscription_payments(id) on delete set null,

  last_message_at   timestamptz not null default now(),
  school_read_at    timestamptz,
  platform_read_at  timestamptz,
  closed_at         timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.support_threads is
  'Maktab va ijrochi o''rtasidagi yozishma mavzusi. O''CHIRILMAYDI — '
  'yopilgani `closed` holatiga o''tadi (TZ 5.4.8).';
comment on column public.support_threads.school_read_at is
  'Maktab oxirgi marta qachon o''qigan. Undan keyingi platforma '
  'xabarlari — o''qilmagan.';

create index if not exists support_threads_school_idx
  on public.support_threads(school_id, last_message_at desc);

create index if not exists support_threads_open_idx
  on public.support_threads(last_message_at desc)
  where status <> 'closed';

select app.attach_touch_trigger('support_threads');

-- ---------------------------------------------------------------------
-- 2. XABAR
--
--  `school_id` bu yerda TAKRORLANADI (mavzuda ham bor). Sabab: RLS
--  siyosati bog'lanishsiz ishlashi kerak — `audit_log` da ham aynan
--  shu yechim qo'llangan. Bog'lanish orqali filtrlash har bir qator
--  uchun qo'shimcha o'qish demakdir.
-- ---------------------------------------------------------------------

create table if not exists public.support_messages (
  id            bigint generated always as identity primary key,
  thread_id     uuid not null references public.support_threads(id) on delete cascade,
  school_id     uuid not null,
  sender_id     uuid,
  from_platform boolean not null,
  -- `system` — tizim o'zi yozgan xabar (chek tasdiqlandi, maktab
  -- bloklandi). Odam yozganidan ajratib turadi.
  is_system     boolean not null default false,
  body          text not null check (length(btrim(body)) >= 1),
  file_path     text,
  created_at    timestamptz not null default now()
);

comment on table public.support_messages is
  'Yozishma xabarlari. FAQAT QO''SHISH — tahrirlash va o''chirish '
  'siyosatlari yaratilmaydi (TZ 5.4.13).';
comment on column public.support_messages.is_system is
  'Tizim avtomatik yozgan xabar: chek tasdiqlandi/rad etildi, maktab '
  'bloklandi. Interfeysda boshqacha ko''rsatiladi.';

create index if not exists support_messages_thread_idx
  on public.support_messages(thread_id, created_at);

create index if not exists support_messages_school_idx
  on public.support_messages(school_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. XABAR QO'SHISH — ICHKI YORDAMCHI
--
--  Mavzuning `last_message_at` va `status` ini xabar bilan BIRGA
--  yangilaydi. Ikkalasi alohida yozilsa, ular bir-biriga mos
--  kelmaydigan holat paydo bo'ladi (xabar bor, mavzu esa hali ham
--  "javob berilgan" deb turadi).
-- ---------------------------------------------------------------------

create or replace function app.support_post(
  p_thread_id     uuid,
  p_school_id     uuid,
  p_sender_id     uuid,
  p_from_platform boolean,
  p_body          text,
  p_file_path     text default null,
  p_is_system     boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.support_messages
    (thread_id, school_id, sender_id, from_platform, is_system, body, file_path)
  values
    (p_thread_id, p_school_id, p_sender_id, p_from_platform, p_is_system,
     btrim(p_body), p_file_path)
  returning id into v_id;

  update public.support_threads
     set last_message_at = now(),
         -- Yopilgan mavzuga yozilsa u qayta ochiladi: savol davom
         -- etayotgan bo'lsa uni sun'iy ravishda yopiq tutish noto'g'ri.
         status = case
           when p_is_system         then status
           when p_from_platform     then 'answered'::public.support_thread_status
           else                          'open'::public.support_thread_status
         end,
         closed_at = case when p_is_system then closed_at else null end,
         -- Yozgan tomon o'z xabarini o'qigan hisoblanadi.
         platform_read_at = case when p_from_platform then now() else platform_read_at end,
         school_read_at   = case when p_from_platform then school_read_at else now() end
   where id = p_thread_id;

  return v_id;
end;
$$;

comment on function app.support_post(uuid, uuid, uuid, boolean, text, text, boolean) is
  'Yozishmaga xabar qo''shadi va mavzu holatini birga yangilaydi. '
  'Faqat ichki chaqiruvlar uchun — RPC lar shu funksiyani ishlatadi.';

revoke all on function app.support_post(uuid, uuid, uuid, boolean, text, text, boolean)
  from public, anon, authenticated;
grant execute on function app.support_post(uuid, uuid, uuid, boolean, text, text, boolean)
  to service_role;
