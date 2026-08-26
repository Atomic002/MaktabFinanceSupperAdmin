-- =====================================================================
--  50 — HISOB-FAKTURA KALENDAR OY BO'YICHA
--
--  MUAMMO. Sikl hisob-fakturani `next_payment_date` yaqinlashganda
--  chiqarardi. TZ 2.4 esa boshqa narsani talab qiladi:
--
--      "Oy boshida, faqat `active` o'quvchilar… Har oyning
--       1-sanasida cron o'lchaydi va `subscription_invoices` ga
--       yozadi — shunda 'o'sha oyda 340 ta bola bor edi' degani
--       hujjatda qoladi va keyinchalik bahslashib bo'lmaydi."
--
--  Farq amaliy. Muddat oyning 23-sanasi bo'lsa, eski shart
--  hisob-fakturani 18-sanada chiqarardi va o'quvchilarni O'SHANDA
--  sanardi. Oyning birinchi yarmida kelib, ikkinchi yarmida chiqib
--  ketgan bola summaga kirib qolardi yoki kirmay qolardi — mijoz
--  esa nima uchun to'layotganini tushunmasdi.
--
--  YECHIM. Shart soddalashtiriladi: JORIY OYGA hisob-faktura yo'q
--  bo'lsa chiqariladi. Cron har kuni ishlagani uchun bu tabiiy
--  ravishda oyning 1-sanasida bajariladi — qo'shimcha kod, qo'shimcha
--  cron va "bugun 1-sanami" degan tekshiruv kerak emas.
--
--  Takrorlanmasligini `subscription_invoices_period_idx` unikal
--  indeksi kafolatlaydi, `issue_subscription_invoice` esa mavjudini
--  topsa `created = false` qaytaradi.
--
--  IKKINCHI O'ZGARISH — XABAR MATNLARI. Ular `suspended` haqida
--  gapirardi ("vaqtincha to'xtatildi"). Endi oxirgi bosqich
--  `restricted` va matnlar zinapoyaga moslanadi. Bundan tashqari TZ
--  talab qiladigan BIRINCHI ESLATMA (+15 kun) qo'shiladi — u holatni
--  o'zgartirmaydi, shuning uchun status o'zgarishiga tayanib bo'lmaydi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BIRINCHI ESLATMA MUDDATI
--
--  Aynan shu kunda bir marta yuboriladi. Cron kunda bir marta
--  ishlagani uchun takrorlanmaydi; kun o'tkazib yuborilsa eslatma
--  ham o'tkazib yuboriladi — bu eslatma, hisob-kitob emas.
-- ---------------------------------------------------------------------

insert into public.platform_settings (key, value, note, is_public)
values ('billing.first_reminder_days', to_jsonb(15),
        'Muddatdan keyin nechanchi kuni birinchi eslatma yuboriladi', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. KUNLIK SIKL
-- ---------------------------------------------------------------------

create or replace function public.run_billing_cycle()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first_rem int := coalesce(app.billing_num('billing.first_reminder_days'), 15)::int;
  v_period    date := date_trunc('month', current_date)::date;
  r           record;
  v_res       jsonb;
  v_invoiced  int := 0;
  v_changed   int := 0;
  v_reminded  int := 0;
  v_errors    int := 0;
  v_overdue   int;
  v_msg       text;
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
      -- --- Hisob-faktura: joriy oyga bormi ------------------------
      --  Sinovdagi maktabga chiqarilmaydi — sinov tugagach
      --  birinchi hisob-faktura keyingi oy boshida o'zi keladi.
      if not (r.sub_status = 'trial'
              and r.trial_ends_at is not null
              and r.trial_ends_at >= current_date)
      then
        v_res := public.issue_subscription_invoice(r.id, v_period);

        if (v_res ->> 'created')::boolean then
          v_invoiced := v_invoiced + 1;
          perform app.notify_school(r.id,
            'Yangi hisob-faktura chiqarildi. Summa: '
            || trim(to_char((v_res ->> 'total')::numeric, '999G999G999'))
            || ' so''m. To''lov muddati: '
            || to_char((v_res ->> 'due_date')::date, 'DD.MM.YYYY') || '.');
        end if;
      end if;

      -- --- Birinchi eslatma: holat o'zgarmaydi --------------------
      if r.next_payment_date is not null then
        v_overdue := current_date - r.next_payment_date;

        if v_overdue = v_first_rem then
          v_reminded := v_reminded + 1;
          perform app.notify_school(r.id,
            'To''lov muddati ' || v_overdue || ' kun oldin o''tdi. '
            || 'Iltimos, to''lovni amalga oshiring va chekni yuboring. '
            || 'Hozircha tizim to''liq ishlamoqda.');
        end if;
      end if;

      -- --- Holat zinapoyasi ---------------------------------------
      v_res := app.recompute_school_billing(r.id);

      if (v_res ->> 'changed')::boolean then
        v_changed := v_changed + 1;

        v_msg := case v_res ->> 'status'
          when 'active' then
            case when (v_res ->> 'from') in ('restricted', 'suspended')
              then 'To''lov qabul qilindi — maktab to''liq ishlashga qaytdi.'
              else null
            end
          when 'restricted' then
            'To''lov ' || (v_res ->> 'overdue_days')
            || ' kun kechikdi. Tizimga kirish VAQTINCHA TO''XTATILDI. '
            || 'Ma''lumotingiz saqlanmoqda va hech narsa yo''qolmaydi: '
            || 'o''quvchilar, hisoblanmalar, to''lovlar, tarix — hammasi '
            || 'joyida. Chekni yuborganingizdan va u tasdiqlangandan '
            || 'keyin hamma narsa avvalgidek ochiladi.'
          else null
        end;

        --  `grace` ga o'tish maktab holatini o'zgartirmaydi
        --  (`active` bo'lib qoladi), lekin ikkinchi eslatma
        --  yuborilishi kerak — TZ 2.4.
        if v_msg is null and (v_res ->> 'subscription_status') = 'grace' then
          v_msg := 'To''lov ' || (v_res ->> 'overdue_days')
            || ' kun kechikdi. Yana '
            || (coalesce(app.billing_num('billing.block_days'), 45)::int
                - (v_res ->> 'overdue_days')::int)
            || ' kundan keyin tizimga kirish to''xtatiladi. '
            || 'Iltimos, to''lovni kechiktirmang.';
        end if;

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
                   jsonb_build_object('period', v_period,
                                      'invoiced', v_invoiced,
                                      'changed', v_changed,
                                      'reminded', v_reminded,
                                      'errors', v_errors));

  return jsonb_build_object('ran_at', now(), 'period', v_period,
                            'invoiced', v_invoiced, 'changed', v_changed,
                            'reminded', v_reminded, 'errors', v_errors);
end;
$$;

comment on function public.run_billing_cycle() is
  'Kunlik to''lov sikli (TZ 2.4): joriy oyga hisob-faktura, '
  'eslatmalar va bloklash zinapoyasi. Cron va super admin chaqiradi.';

revoke all on function public.run_billing_cycle() from public, anon;
grant execute on function public.run_billing_cycle() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. `invoice_lead_days` ENDI KERAK EMAS
--
--  U "muddatdan necha kun oldin hisob-faktura chiqarilsin" degan
--  sozlama edi. Kalendar oyga o'tgach ma'nosini yo'qotdi.
-- ---------------------------------------------------------------------

delete from public.platform_settings where key = 'billing.invoice_lead_days';

-- ---------------------------------------------------------------------
-- 4. TEKSHIRUV
-- ---------------------------------------------------------------------

do $do$
begin
  if exists (select 1 from public.platform_settings
              where key = 'billing.invoice_lead_days') then
    raise exception 'invoice_lead_days o''chirilmadi';
  end if;

  if coalesce(app.billing_num('billing.first_reminder_days'), 0) <> 15 then
    raise exception 'first_reminder_days 15 bo''lishi kerak edi';
  end if;

  raise notice 'Tekshiruv: sozlamalar joyida';
end $do$;
