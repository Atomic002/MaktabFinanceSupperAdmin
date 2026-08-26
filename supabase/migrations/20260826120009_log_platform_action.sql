-- =====================================================================
--  47 — EDGE FUNCTION UCHUN JURNAL CHAQIRUVI
--
--  MUAMMO: `app.plog` faqat `service_role` ga berilgan va `app`
--  sxemasi PostgREST orqali tashqariga CHIQARILMAYDI. Ya'ni Edge
--  Function bajargan amalni jurnalga yozishning yo'li yo'q edi.
--
--  Bu amaliy muammo: `platform-ops` funksiyasi direktor parolini
--  tiklaydi va yangi maktab ulaydi. Ikkalasi ham maktab hisobiga
--  aralashuv va jurnalsiz qolmasligi kerak (TZ 4.13.7).
--
--  YECHIM: yupqa ochiq qobiq. U hech qanday o'zgarish qilmaydi,
--  faqat yozadi — va faqat platforma admini chaqira oladi.
--
--  NEGA `entity` VA `action` ERKIN MATN: jurnal turlari kelajakda
--  ko'payadi. Enum qilinsa har bir yangi amal migratsiya talab
--  qilardi va oxir-oqibat odamlar jurnalga yozishni tashlab
--  ketardi — bu esa eng yomon natija.
-- =====================================================================

create or replace function public.log_platform_action(
  p_action    text,
  p_entity    text default null,
  p_entity_id text default null,
  p_school_id uuid default null,
  p_detail    jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();

  if p_action is null or length(btrim(p_action)) = 0 then
    raise exception 'Amal nomi ko''rsatilishi shart' using errcode = '22023';
  end if;

  perform app.plog(btrim(p_action), p_entity, p_entity_id, p_school_id,
                   null, p_detail);
end;
$$;

comment on function public.log_platform_action(text, text, text, uuid, jsonb) is
  'Edge Function bajargan amalni platforma jurnaliga yozadi. '
  'Faqat yozadi — hech narsani o''zgartirmaydi.';

revoke all on function public.log_platform_action(text, text, text, uuid, jsonb)
  from public, anon;
grant execute on function public.log_platform_action(text, text, text, uuid, jsonb)
  to authenticated, service_role;
