-- =====================================================================
--  44 — AVTOMATIK HISOB-FAKTURA VA BLOKLASH
--
--  MUAMMO: bloklash mexanizmi bor (`suspended`, `restricted`), lekin
--  uni ISHGA TUSHIRADIGAN narsa yo'q. Kimdir har kuni qo'lda ko'rib
--  chiqishi kerak edi — bu esa 2–5 kishilik jamoada birinchi bo'lib
--  unutiladigan ish.
--
--  YECHIM: kuniga bir marta ishlaydigan cron. U ikki ish qiladi:
--    1. muddati kelayotgan maktablarga hisob-faktura chiqaradi
--    2. kechikish kunlariga qarab holatni qayta hisoblaydi
--
--  BLOKLASH ZINAPOYASI (parametrlar `platform_settings` da):
--
--    | kechikish   | obuna      | maktab     | nima ishlaydi        |
--    |-------------|------------|------------|----------------------|
--    | muddat kelmagan | active | active     | hammasi              |
--    | 0 … 14 kun  | grace      | active     | hammasi + ogohlantirish |
--    | 15 … 44 kun | restricted | restricted | faqat o'qish         |
--    | 45+ kun     | suspended  | suspended  | faqat obuna va yozishma |
--
--  MUHIM: har bir o'tish maktabga XABAR bilan bildiriladi. "Nega
--  ishlamay qoldi" degan savol bilan qo'ng'iroq qilishdan oldin
--  javob panelda turgan bo'lsin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MAKTABGA TIZIM XABARI
--
--  Bloklash bilan bog'liq xabarlar bitta doimiy mavzuda to'planadi —
--  har safar yangi mavzu ochilsa ro'yxat o'nlab bir qatorli
--  mavzular bilan to'lib ketadi.
-- ---------------------------------------------------------------------

create or replace function app.notify_school(p_school_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread uuid;
begin
  select id into v_thread
    from public.support_threads
   where school_id = p_school_id
     and subject = 'Obuna va to''lov'
     and opened_by_platform
   order by created_at
   limit 1;

  if v_thread is null then
    insert into public.support_threads
      (school_id, subject, priority, opened_by_platform)
    values
      (p_school_id, 'Obuna va to''lov', 'high', true)
    returning id into v_thread;
  end if;

  perform app.support_post(v_thread, p_school_id, null, true, p_body, null, true);
  return v_thread;
end;
$$;

revoke all on function app.notify_school(uuid, text) from public, anon, authenticated;
grant execute on function app.notify_school(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 2. KUNLIK TO'LOV SIKLI
--
--  Har bir maktab uchun alohida `begin ... exception` bloki: bitta
--  maktabdagi xato butun siklni to'xtatib qo'ymasin, qolganlari
--  baribir qayta hisoblansin.
-- ---------------------------------------------------------------------

create or replace function public.run_billing_cycle()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead     int := coalesce(app.billing_num('billing.invoice_lead_days'), 5)::int;
  r          record;
  v_res      jsonb;
  v_invoiced int := 0;
  v_changed  int := 0;
  v_errors   int := 0;
  v_msg      text;
begin
  if not (app.is_service_context() or app.is_platform_admin()) then
    raise exception 'Bu amal faqat platforma operatori uchun'
      using errcode = '42501';
  end if;

  for r in
    select s.id, s.name, s.status as school_status,
           sub.status as sub_status, sub.next_payment_date, sub.trial_ends_at
      from public.schools s
      join public.school_subscriptions sub on sub.school_id = s.id
     where s.deleted_at is null
       and s.status <> 'archived'
       and sub.status <> 'cancelled'
     order by s.name
  loop
    begin
      -- --- Hisob-faktura ------------------------------------------
      --  Muddat yaqinlashganda chiqariladi. Sinovdagi maktabga
      --  chiqarilmaydi — sinov tugagach birinchi hisob-faktura
      --  o'z-o'zidan keladi.
      if r.next_payment_date is not null
         and r.next_payment_date <= current_date + v_lead
         and not (r.sub_status = 'trial'
                  and r.trial_ends_at is not null
                  and r.trial_ends_at >= current_date)
      then
        v_res := public.issue_subscription_invoice(
                   r.id, date_trunc('month', r.next_payment_date)::date);
        if (v_res ->> 'created')::boolean then
          v_invoiced := v_invoiced + 1;
          perform app.notify_school(r.id,
            'Yangi hisob-faktura chiqarildi. Summa: '
            || trim(to_char((v_res ->> 'total')::numeric, '999G999G999'))
            || ' so''m. To''lov muddati: '
            || to_char((v_res ->> 'due_date')::date, 'DD.MM.YYYY') || '.');
        end if;
      end if;

      -- --- Holat zinapoyasi ----------------------------------------
      v_res := app.recompute_school_billing(r.id);

      if (v_res ->> 'changed')::boolean then
        v_changed := v_changed + 1;

        v_msg := case v_res ->> 'status'
          when 'active' then
            'To''lov qabul qilindi — maktab to''liq ishlashga qaytdi.'
          when 'restricted' then
            'To''lov ' || (v_res ->> 'overdue_days')
            || ' kun kechikdi. Maktab FAQAT O''QISH rejimiga o''tdi: '
            || 'ma''lumot joyida, lekin yangi yozuv kiritib bo''lmaydi. '
            || 'To''lovdan keyin hammasi darhol tiklanadi.'
          when 'suspended' then
            'To''lov ' || (v_res ->> 'overdue_days')
            || ' kun kechikdi. Maktab VAQTINCHA TO''XTATILDI. '
            || 'Ma''lumotingiz saqlanmoqda va hech narsa yo''qolmaydi. '
            || 'Chekni yuborganingizdan va u tasdiqlangandan keyin '
            || 'hamma narsa avvalgidek ishlaydi.'
          else null
        end;

        if v_msg is not null then
          perform app.notify_school(r.id, v_msg);
        end if;
      end if;

    exception when others then
      v_errors := v_errors + 1;
      raise notice 'To''lov sikli xatosi (%): %', r.name, sqlerrm;
    end;
  end loop;

  perform app.plog('billing_cycle_run', 'schools', null, null, null,
                   jsonb_build_object('invoiced', v_invoiced,
                                      'changed', v_changed,
                                      'errors', v_errors));

  return jsonb_build_object('ran_at', now(), 'invoiced', v_invoiced,
                            'changed', v_changed, 'errors', v_errors);
end;
$$;

comment on function public.run_billing_cycle() is
  'Kunlik to''lov sikli: hisob-faktura chiqarish va bloklash '
  'zinapoyasini qo''llash. Cron va super admin qo''lda chaqiradi.';

revoke all on function public.run_billing_cycle() from public, anon;
grant execute on function public.run_billing_cycle() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. CRON
--
--  02:00 UTC = 07:00 Toshkent. Ish kuni boshlanishidan oldin: agar
--  maktab bloklangan bo'lsa, direktor buni ertalab birinchi bo'lib
--  ko'radi va kun davomida hal qila oladi.
--
--  Mavjud vazifalar bilan bir xil naqsh: idempotent, `pg_cron`
--  bo'lmasa jimgina o'tib ketadi.
-- ---------------------------------------------------------------------

do $do$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron yo''q — to''lov sikli rejalashtirilmadi.';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'maktab_billing_cycle') then
    perform cron.unschedule('maktab_billing_cycle');
  end if;

  perform cron.schedule('maktab_billing_cycle', '0 2 * * *',
                        'select public.run_billing_cycle();');
  raise notice 'Cron rejalashtirildi: maktab_billing_cycle';
exception when others then
  raise notice 'Cron rejalashtirilmadi: %', sqlerrm;
end $do$;
