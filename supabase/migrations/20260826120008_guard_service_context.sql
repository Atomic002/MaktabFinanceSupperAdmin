-- =====================================================================
--  46 — `guard_school_status` SERVER KONTEKSTINI TAN OLMAYDI
--
--  MUAMMO — sinov topdi (`scripts/test-platform.sql`):
--
--    ERROR: 42501: Maktab holatini faqat platforma operatori
--    o'zgartiradi
--    CONTEXT: app.guard_school_status() ← app.recompute_school_billing()
--
--  Triggerda shart shunday edi:
--
--    if new.status is distinct from old.status
--       and not app.is_platform_admin() then raise ...
--
--  `app.is_platform_admin()` `auth.uid()` ga tayanadi. Cron va Edge
--  Function da JWT umuman yo'q — `auth.uid()` null, demak funksiya
--  `false` qaytaradi va TRIGGER O'Z SERVERIMIZNI TO'XTATADI.
--
--  OQIBATI: kunlik to'lov sikli bironta maktabni `restricted` yoki
--  `suspended` ga o'tkaza olmasdi. Ya'ni butun avtomatik bloklash
--  ishlamas edi — va buni faqat 45 kundan keyin, "nega hech kim
--  bloklanmadi" degan savol bilan sezgan bo'lardik.
--
--  YECHIM: serverning o'z konteksti ham ruxsat etiladi. Bu yangi
--  teshik OCHMAYDI: `app.is_service_context()` JWT dagi `role`
--  claim'ini tekshiradi, PostgREST orqali kelgan har bir mijoz
--  so'rovida esa u `authenticated` bo'ladi. Maktab foydalanuvchisi
--  bu shartga hech qachon tushmaydi.
--
--  Aynan shu juftlik loyihada allaqachon ishlatilgan —
--  `provision_school` va `seed_school_defaults` da:
--    if not (app.is_service_context() or app.is_platform_admin())
-- =====================================================================

create or replace function app.guard_school_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not (app.is_platform_admin() or app.is_service_context()) then
    raise exception 'Maktab holatini faqat platforma operatori o''zgartiradi'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function app.guard_school_status() is
  'Maktab foydalanuvchisi `schools.status` ni o''zgartira olmaydi. '
  'Platforma admini va SERVER KONTEKSTI (cron, RPC) ruxsat etiladi — '
  'aks holda avtomatik bloklash ishlamaydi.';

-- ---------------------------------------------------------------------
--  TEKSHIRUV — trigger o'rnida turibdimi
--
--  `create or replace function` triggerni qayta bog'lamaydi, lekin
--  kimdir uni tasodifan o'chirib qo'ygan bo'lsa shu yerda ko'rinadi.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_schools_guard_status' and not tgisinternal
  ) then
    raise exception 'trg_schools_guard_status triggeri yo''q — '
                    'maktab o''z holatini o''zgartira oladi';
  end if;
  raise notice 'Tekshiruv: trg_schools_guard_status joyida';
end $$;
