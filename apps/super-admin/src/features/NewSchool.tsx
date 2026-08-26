// =====================================================================
//  Yangi maktabni ulash (TZ E3).
//
//  Bitta forma → Edge Function → maktab + filial + obuna + shablon
//  sozlamalar + direktor hisobi + birinchi hisob-faktura.
//
//  PAROL BIR MARTA KO'RSATILADI va boshqa hech qayerda saqlanmaydi.
//  Shuning uchun natija ekrani ataylab "yopib bo'lmaydigan" qilingan:
//  nusxa olish tugmasi bor va yopishdan oldin tasdiqlash so'raladi.
//
//  NARX JONLI HISOBLANADI: operator o'quvchi sonini kiritganda
//  summa darhol ko'rinadi. Bu sotuv suhbatida kerak — "300 ta
//  o'quvchi bo'lsa qancha bo'ladi" degan savolga sahifani tark
//  etmasdan javob beriladi.
// =====================================================================

import { type FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { callPlatformOps, supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { money } from '@/lib/format';
import { computePrice, readParams } from '@/lib/pricing';
import {
  Button, Card, Field, Input, Notice, PageHeader, Select,
} from '@/ui';
import { useConfirm, useToast } from '@/ui/Feedback';

interface Result {
  school_id: string;
  login: string;
  password: string;
}

export default function NewSchool() {
  const t = useT();
  const { lang } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [login, setLogin] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [planCode, setPlanCode] = useState('basic');
  const [trialDays, setTrialDays] = useState(30);

  // Faqat narxni ko'rsatish uchun — bazaga yozilmaydi.
  const [expectStudents, setExpectStudents] = useState('');
  const [expectBranches, setExpectBranches] = useState('1');

  const [result, setResult] = useState<Result | null>(null);

  const settings = useQuery({
    queryKey: ['platform-settings-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings').select('key, value');
      if (error) throw error;
      return data ?? [];
    },
  });

  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans').select('code, name').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });

  const params = useMemo(() => readParams(settings.data), [settings.data]);
  const preview = useMemo(
    () => computePrice(Number(expectBranches), Number(expectStudents), params),
    [expectBranches, expectStudents, params],
  );

  const create = useMutation({
    mutationFn: async () => await callPlatformOps<Result>({
      action: 'provision_school',
      name: name.trim(),
      branch_name: branchName.trim() || undefined,
      login: login.trim(),
      director_name: directorName.trim() || undefined,
      plan_code: planCode,
      trial_days: trialDays,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
    }),
    onSuccess: (d) => { setResult(d); toast.ok(t('newSchool.created')); },
    onError: (e) => toast.error((e as Error).message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() && login.trim()) create.mutate();
  }

  async function closeResult() {
    const ok = await confirm({
      title: t('newSchool.confirmCloseTitle'),
      message: t('newSchool.confirmClose'),
      danger: true,
    });
    if (ok) navigate(`/maktablar/${result!.school_id}`);
  }

  // --- Natija ekrani ------------------------------------------------
  if (result) {
    return (
      <>
        <PageHeader title={t('newSchool.done')} />
        <Card title={t('newSchool.credentials')} className="max-w-lg">
          <Notice tone="warn">{t('newSchool.passwordOnce')}</Notice>

          <div className="mt-3 space-y-2">
            <Field label={t('newSchool.login')}>
              <Input value={result.login} readOnly onFocus={(e) => e.currentTarget.select()} />
            </Field>
            <Field label={t('newSchool.password')}>
              <Input value={result.password} readOnly onFocus={(e) => e.currentTarget.select()} />
            </Field>
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                navigator.clipboard
                  .writeText(`${result.login}\n${result.password}`)
                  .then(() => toast.ok(t('newSchool.copied')))
                  .catch(() => toast.error(t('newSchool.copyFailed')));
              }}
            >
              {t('newSchool.copy')}
            </Button>
            <Button onClick={closeResult}>{t('newSchool.toCard')}</Button>
          </div>
        </Card>
      </>
    );
  }

  // --- Forma --------------------------------------------------------
  return (
    <>
      <PageHeader
        title={t('newSchool.title')}
        subtitle={t('newSchool.subtitle')}
        actions={<Link to="/maktablar"><Button>{t('common.back')}</Button></Link>}
      />

      <form onSubmit={onSubmit} className="grid gap-3 lg:grid-cols-2">
        <Card title={t('newSchool.school')}>
          <div className="space-y-3">
            <Field label={t('schools.name')} required>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                     autoFocus required />
            </Field>
            <Field label={t('newSchool.branch')} hint={t('newSchool.branchHint')}>
              <Input value={branchName} onChange={(e) => setBranchName(e.target.value)}
                     placeholder="Asosiy filial" />
            </Field>
            <Field label={t('school.address')}>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label={t('schools.phone')}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                     inputMode="tel" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('schools.plan')}>
                <Select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
                  {(plans.data ?? []).map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t('newSchool.trialDays')}>
                <Select value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))}>
                  {[0, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </Card>

        <Card title={t('newSchool.director')}>
          <div className="space-y-3">
            <Field label={t('newSchool.directorName')}>
              <Input value={directorName} onChange={(e) => setDirectorName(e.target.value)}
                     placeholder="Direktor" />
            </Field>
            <Field
              label={t('newSchool.login')}
              hint={t('newSchool.loginHint')}
              required
            >
              <Input value={login} onChange={(e) => setLogin(e.target.value)}
                     placeholder="direktor@maktab.uz" required />
            </Field>

            <Notice tone="brand">{t('newSchool.passwordAuto')}</Notice>
          </div>
        </Card>

        {/* --- Narx kalkulyatori. Bazaga yozilmaydi. ---------------- */}
        <Card title={t('newSchool.priceCalc')} className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('newSchool.expectBranches')}>
              <Input
                value={expectBranches} inputMode="numeric"
                onChange={(e) => setExpectBranches(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label={t('newSchool.expectStudents')}>
              <Input
                value={expectStudents} inputMode="numeric"
                onChange={(e) => setExpectStudents(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <div className="sm:col-span-2">
              <div className="rounded-md border bg-[var(--bg-subtle)] p-3 text-[13px]">
                <div className="flex justify-between">
                  <span>{t('price.base')}</span>
                  <span className="num">{money(preview.baseAmount, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('price.branches', { count: String(preview.branches - 1) })}</span>
                  <span className="num">{money(preview.branchesAmount, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('price.students', {
                    steps: String(preview.steps), extra: String(preview.extra),
                  })}</span>
                  <span className="num">{money(preview.studentsAmount, lang)}</span>
                </div>
                <div className="mt-1.5 flex justify-between border-t pt-1.5 font-semibold">
                  <span>{t('price.monthlyTotal')}</span>
                  <span className="num">{money(preview.monthlyTotal, lang)}</span>
                </div>
                <div className="mt-1 flex justify-between text-[var(--text-muted)]">
                  <span>{t('price.setupOnce')}</span>
                  <span className="num">{money(params.setup_fee, lang)}</span>
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-faint)]">
                  {t('newSchool.priceHint', {
                    included: String(preview.included),
                    perBranch: String(params.students_per_branch),
                  })}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim() || !login.trim() || create.isPending}
          >
            {create.isPending ? t('newSchool.creating') : t('newSchool.create')}
          </Button>
        </div>
      </form>
    </>
  );
}
