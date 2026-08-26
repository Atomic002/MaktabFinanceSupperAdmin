// =====================================================================
//  Narx parametrlari va bloklash muddatlari.
//
//  Bu ekrandagi har bir raqam BARCHA maktablarga ta'sir qiladi.
//  Shuning uchun:
//    · o'zgarish darhol saqlanmaydi — avval jonli hisob ko'rsatiladi
//    · har bir o'zgarish `platform_log` ga tushadi
//    · bloklash muddatlari alohida bo'limda, ogohlantirish bilan
//
//  Narxlar `is_public = true` — maktab ham ko'radi. Bu ataylab:
//  direktor hisob-fakturani mustaqil tekshira olishi kerak.
// =====================================================================

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { money } from '@/lib/format';
import { computePrice, readParams } from '@/lib/pricing';
import {
  Badge, Button, Card, ErrorState, Field, Input, Loading, Notice,
  PageHeader, Table, Td, Th, Tr,
} from '@/ui';
import { useConfirm, useToast } from '@/ui/Feedback';

/** Tahrirlanadigan kalitlar va ular qanday guruhlanishi. */
const PRICE_KEYS = [
  'billing.setup_fee',
  'billing.base_monthly',
  'billing.branch_price',
  'billing.students_per_branch',
  'billing.student_step',
  'billing.student_step_price',
] as const;

//  Bloklash zinapoyasi (TZ 2.4). `invoice_lead_days` 50-migratsiyada
//  olib tashlangan: hisob-faktura endi kalendar oy boshida chiqadi,
//  ya'ni "muddatdan necha kun oldin" degan savol yo'qoldi.
const LOCK_KEYS = [
  'billing.first_reminder_days',
  'billing.grace_days',
  'billing.block_days',
] as const;

export default function Settings() {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  const settings = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value, note, is_public, updated_at')
        .order('key');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Tahrirlanmagan maydonlar bazadagi qiymatni ko'rsatib tursin.
  useEffect(() => {
    if (!settings.data) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const row of settings.data) {
        if (next[row.key] === undefined) next[row.key] = String(row.value);
      }
      return next;
    });
  }, [settings.data]);

  const params = useMemo(
    () => readParams(
      Object.entries(draft).map(([key, value]) => ({ key, value: Number(value) })),
    ),
    [draft],
  );

  //  Rekvizitlar — YAGONA matnli sozlama. Raqamli `save` dan
  //  ajratilgan, chunki u `Number()` ga o'tkazadi va matnni buzardi.
  const saveText = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase.rpc('set_platform_setting', {
        p_key: key,
        p_value: value,
        p_reason: reason.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.ok(t('ux.saved'));
      qc.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const save = useMutation({
    mutationFn: async (key: string) => {
      const raw = draft[key];
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) throw new Error(t('settings.invalid'));
      const { error } = await supabase.rpc('set_platform_setting', {
        p_key: key,
        p_value: n,
        p_reason: reason.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.ok(t('ux.saved'));
      qc.invalidateQueries({ queryKey: ['platform-settings'] });
      qc.invalidateQueries({ queryKey: ['platform-settings-public'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (settings.isLoading) return <Loading />;
  if (settings.error) {
    return <ErrorState message={(settings.error as Error).message}
                       onRetry={() => settings.refetch()} />;
  }

  const rows = settings.data ?? [];
  const changed = (key: string) =>
    String(rows.find((r) => r.key === key)?.value) !== draft[key];

  async function onSave(key: string) {
    // Bloklash muddatlari — qaytarilishi qiyin oqibat: xato qiymat
    // ertaga o'nlab maktabni bloklab qo'yishi mumkin.
    if (LOCK_KEYS.includes(key as typeof LOCK_KEYS[number])) {
      const ok = await confirm({
        title: t('settings.confirmTitle'),
        message: t('settings.confirmLock'),
        warning: t('settings.confirmLockWarning'),
        danger: true,
      });
      if (!ok) return;
    }
    save.mutate(key);
  }

  function renderRow(key: string) {
    const row = rows.find((r) => r.key === key);
    if (!row) return null;
    return (
      <Tr key={key}>
        <Td>
          <span className="font-medium">{t(`setting.${key.replace('billing.', '')}`)}</span>
          <span className="ml-1.5 text-[11px] text-[var(--text-faint)]">{row.note}</span>
          {row.is_public && <Badge>{t('settings.public')}</Badge>}
        </Td>
        <Td className="w-48">
          <Input
            value={draft[key] ?? ''}
            inputMode="numeric"
            onChange={(e) =>
              setDraft((d) => ({ ...d, [key]: e.target.value.replace(/\D/g, '') }))}
            className={changed(key) ? 'border-[var(--warn)]' : ''}
          />
        </Td>
        <Td align="right" className="w-28">
          <Button
            size="sm"
            variant={changed(key) ? 'primary' : 'ghost'}
            disabled={!changed(key) || save.isPending}
            onClick={() => onSave(key)}
          >
            {t('common.save')}
          </Button>
        </Td>
      </Tr>
    );
  }

  // Jonli misollar — o'zgarish nimaga olib kelishini raqamda ko'rsatadi.
  const examples = [
    { b: 1, s: 200 },
    { b: 1, s: 320 },
    { b: 2, s: 600 },
    { b: 3, s: 900 },
  ].map((x) => ({ ...x, price: computePrice(x.b, x.s, params) }));

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Notice tone="warn">{t('settings.globalWarning')}</Notice>

      <div className="my-3 max-w-md">
        <Field label={t('settings.reason')} hint={t('settings.reasonHint')}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>

      <Card title={t('settings.prices')} padded={false} className="mb-3">
        <Table>
          <thead>
            <tr>
              <Th>{t('settings.param')}</Th>
              <Th>{t('settings.value')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>{PRICE_KEYS.map(renderRow)}</tbody>
        </Table>
      </Card>

      <Card title={t('settings.examples')} padded={false} className="mb-3">
        <Table>
          <thead>
            <tr>
              <Th align="right">{t('schools.branches')}</Th>
              <Th align="right">{t('schools.students')}</Th>
              <Th align="right">{t('settings.included')}</Th>
              <Th align="right">{t('settings.steps')}</Th>
              <Th align="right">{t('price.monthlyTotal')}</Th>
            </tr>
          </thead>
          <tbody>
            {examples.map((x) => (
              <Tr key={`${x.b}-${x.s}`}>
                <Td align="right" mono>{x.b}</Td>
                <Td align="right" mono>{x.s}</Td>
                <Td align="right" mono>{x.price.included}</Td>
                <Td align="right" mono>{x.price.steps}</Td>
                <Td align="right" mono className="font-semibold">
                  {money(x.price.monthlyTotal, lang)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <p className="px-4 pb-3 text-[11px] text-[var(--text-faint)]">
          {t('settings.examplesHint')}
        </p>
      </Card>

      {/* --- To'lov rekvizitlari (TZ P2) --------------------------
           Bloklangan maktab ekranida shu matn ko'rinadi. Bank
           o'zgarsa migratsiya emas, shu maydon yangilanadi. */}
      <Card title={t('settings.requisites')} className="mb-3">
        <p className="mb-2 text-[13px] text-[var(--text-muted)]">
          {t('settings.requisitesHint')}
        </p>
        <textarea
          value={draft['billing.requisites'] ?? ''}
          onChange={(e) =>
            setDraft((d) => ({ ...d, 'billing.requisites': e.target.value }))}
          rows={8}
          className="w-full rounded-md border bg-[var(--bg)] px-2.5 py-2
            font-mono text-[13px] text-[var(--text)] focus:border-brand-500"
        />
        <div className="mt-2">
          <Button
            variant={changed('billing.requisites') ? 'primary' : 'ghost'}
            disabled={!changed('billing.requisites') || saveText.isPending}
            onClick={() => saveText.mutate({
              key: 'billing.requisites',
              value: draft['billing.requisites'] ?? '',
            })}
          >
            {t('common.save')}
          </Button>
        </div>
      </Card>

      <Card title={t('settings.lock')} padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>{t('settings.param')}</Th>
              <Th>{t('settings.value')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>{LOCK_KEYS.map(renderRow)}</tbody>
        </Table>
        <div className="p-4">
          <Notice tone="danger">{t('settings.lockWarning')}</Notice>
        </div>
      </Card>
    </>
  );
}
