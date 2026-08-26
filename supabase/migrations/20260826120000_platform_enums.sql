-- =====================================================================
--  38 — PLATFORMA: YANGI HOLATLAR VA TURLAR
--
--  MUAMMO: mavjud `school_status` da to'lov kechikkanda faqat bitta
--  bosqich bor — `restricted` (o'qish ishlaydi, yozish yo'q). Lekin
--  to'lovni umuman qilmagan maktab yillab shu holatda o'tirib,
--  ma'lumotini bemalol o'qib turaveradi. Ijrochi uchun bu — bepul
--  xizmat.
--
--  YECHIM: uchinchi bosqich — `suspended`. Muddat o'tgandan 45 kun
--  keyin maktab hech narsani ko'rmaydi: faqat obuna, chek yuborish va
--  qo'llab-quvvatlash yozishmasi ochiq qoladi. Ma'lumot JOYIDA turadi
--  va to'lov tasdiqlangan zahoti hammasi qaytadi.
--
--  NEGA ALOHIDA MIGRATSIYA: PostgreSQL da `alter type ... add value`
--  bilan qo'shilgan qiymatni AYNAN O'SHA tranzaksiyada ishlatib
--  bo'lmaydi. `db.mjs` har bir faylni bitta tranzaksiyada bajaradi,
--  shuning uchun qiymatlar shu yerda qo'shiladi, ishlatilishi esa
--  keyingi migratsiyalarda.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MAVJUD HOLATLARGA YANGI BOSQICH
-- ---------------------------------------------------------------------

alter type public.school_status       add value if not exists 'suspended';
alter type public.subscription_status add value if not exists 'suspended';

-- ---------------------------------------------------------------------
-- 2. OBUNA HISOB-FAKTURASI HOLATI
--
--  Hisob-faktura o'chirilmaydi (TZ 5.4.8) — xato chiqarilgani
--  `void` bilan bekor qilinadi va jurnalda qoladi.
-- ---------------------------------------------------------------------

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_invoice_status') then
    create type public.subscription_invoice_status as enum (
      'unpaid',   -- Chiqarilgan, to'lanmagan
      'partial',  -- Qisman to'langan
      'paid',     -- To'liq to'langan
      'void'      -- Bekor qilingan (xato chiqarilgan)
    );
  end if;
end $do$;

-- ---------------------------------------------------------------------
-- 3. MAKTAB YUBORGAN CHEK HOLATI
--
--  `pending` qarzni YOPMAYDI — xuddi ota-ona cheki kabi (TZ 4.7.3).
--  Faqat super admin tasdiqlagandan keyin obuna uzaytiriladi.
-- ---------------------------------------------------------------------

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_payment_status') then
    create type public.subscription_payment_status as enum (
      'pending',    -- Maktab yubordi, super admin ko'rmagan
      'confirmed',  -- Tasdiqlandi — obuna uzaytirildi
      'rejected'    -- Rad etildi, sabab ko'rsatilgan
    );
  end if;
end $do$;

-- ---------------------------------------------------------------------
-- 4. QO'LLAB-QUVVATLASH YOZISHMASI HOLATI
-- ---------------------------------------------------------------------

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'support_thread_status') then
    create type public.support_thread_status as enum (
      'open',      -- Ochiq — javob kutilmoqda
      'answered',  -- Super admin javob berdi
      'closed'     -- Yopilgan
    );
  end if;
end $do$;

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'support_priority') then
    create type public.support_priority as enum ('low', 'normal', 'high');
  end if;
end $do$;
