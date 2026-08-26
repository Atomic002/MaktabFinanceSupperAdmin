-- =====================================================================
--  51 — TO'LOV REKVIZITLARI
--
--  MUAMMO. TZ P2 bloklangan maktab ekranida uchta narsani talab
--  qiladi: qarzdorlik summasi, TO'LOV REKVIZITLARI va chek yuklash
--  tugmasi. Rekvizitlar hech qayerda saqlanmasdi — direktor pulni
--  qayerga o'tkazishini bilmasdi va yozishma orqali so'rashi kerak
--  edi. Ya'ni bloklangan maktab yana bir qadam uzoqda qolardi.
--
--  YECHIM. Rekvizitlar `platform_settings` da, `is_public = true`
--  bilan — maktab ham ko'radi. Bu narx parametrlari bilan bir xil
--  naqsh: raqamlar ham, rekvizitlar ham bazada, kodda emas
--  (qat'iy talab #13 ruhi). Bank o'zgarsa migratsiya yozilmaydi.
--
--  NEGA MATN, JADVAL EMAS. Rekvizit — bank nomi, hisob raqami, MFO,
--  INN, qabul qiluvchi. Ularning tarkibi vaqt bilan o'zgaradi va
--  har birini alohida ustunga solish foyda bermaydi: ekranda ular
--  baribir bitta blok bo'lib chiqadi. Erkin matn esa operatorga
--  to'liq erkinlik beradi.
-- =====================================================================

insert into public.platform_settings (key, value, note, is_public)
values (
  'billing.requisites',
  to_jsonb(
    'Uztomic Solutions MChJ'                   || E'\n' ||
    'INN: __________'                          || E'\n' ||
    'H/r: ____________________'                || E'\n' ||
    'Bank: __________________'                 || E'\n' ||
    'MFO: _____'                               || E'\n' ||
    E'\n' ||
    'To''lov maqsadi: maktab nomi va davr (masalan: "Zamon maktabi, 2026-09")'
  ),
  'Bloklangan maktab ekranida ko''rsatiladigan to''lov rekvizitlari',
  true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
--  MATNLI SOZLAMANI O'ZGARTIRISH
--
--  `set_platform_setting` jsonb qabul qiladi va son ham, matn ham
--  o'tadi. Alohida funksiya kerak emas — shu izoh keyingi o'quvchi
--  "nega matn uchun funksiya yo'q" deb qidirmasligi uchun.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from public.platform_settings
                  where key = 'billing.requisites' and is_public) then
    raise exception 'billing.requisites qo''shilmadi yoki ochiq emas';
  end if;
  raise notice 'Tekshiruv: to''lov rekvizitlari sozlamasi joyida';
end $$;
