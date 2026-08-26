// =====================================================================
//  Maktablar ro'yxati (TZ E1) — asosiy ekran.
//
//  MIJOZ MAZMUNI YO'Q (TZ 2.1). Bu yerda faqat O'LCHAM va HOLAT:
//  nechta o'quvchi, nechta filial, qancha to'laydi, qachon to'laydi.
//  O'quvchi ismi, qarzdorlik, to'lov summasi — yo'q va bo'lmaydi.
//
//  IKKI SIGNAL ajratib ko'rsatiladi:
//    · muddati o'tgan to'lov — qizil, kechikish kuni bilan
//    · chegaradan oshgan o'quvchi — bu SOTUV IMKONIYATI, ya'ni
//      maktab pul to'lamayotgan xizmatdan foydalanmoqda
// =====================================================================

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { date, money } from '@/lib/format';
import { exportTable } from '@/lib/export';
import {
  Badge, Button, EmptyState, ErrorState, Input, Loading, Money,
  PageHeader, Select, Table, Td, Th, Tr,
} from '@/ui';
import { useSort } from '@/ui/Feedback';

type Row = {
  school_id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  status: string;
  plan_code: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  monthly_amount: number | null;
  trial_ends_at: string | null;
  next_payment_date: string | null;
  overdue_days: number | null;
  students_count: number;
  branches_count: number;
  users_count: number;
  students_included: number;
  over_limit: boolean;
  unpaid_amount: number | null;
  pending_payments: number;
  unread_messages: number;
  last_activity: string | null;
};

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'brand' | 'neutral'> = {
  trial: 'brand',
  active: 'ok',
  restricted: 'danger',
  archived: 'neutral',
};

type Filter = 'all' | 'overdue' | 'trial' | 'restricted' | 'overlimit' | 'pending';

/**
 * Excel ustunlari. Sotuv va buxgalteriya uchun — shuning uchun
 * ekranda ko'rinmaydigan bir nechta ustun ham qo'shilgan (INN,
 * telefon, tarif). Mijoz mazmuni bu yerda ham YO'Q.
 */
const EXPORT_COLUMNS = (t: (k: string) => string) => [
  { header: t('schools.name'),        value: (r: Row) => r.name },
  { header: t('schools.taxId'),       value: (r: Row) => r.tax_id },
  { header: t('schools.phone'),       value: (r: Row) => r.phone },
  { header: t('schools.status'),      value: (r: Row) => t(`status.${r.status}`) },
  { header: t('schools.plan'),        value: (r: Row) => r.plan_name },
  { header: t('schools.students'),    value: (r: Row) => r.students_count, numeric: true },
  { header: t('schools.limit'),       value: (r: Row) => r.students_included, numeric: true },
  { header: t('schools.branches'),    value: (r: Row) => r.branches_count, numeric: true },
  { header: t('schools.monthly'),     value: (r: Row) => r.monthly_amount, numeric: true },
  { header: t('schools.nextPayment'), value: (r: Row) => r.next_payment_date },
  { header: t('schools.overdueDays'), value: (r: Row) => r.overdue_days, numeric: true },
  { header: t('schools.unpaid'),      value: (r: Row) => r.unpaid_amount, numeric: true },
];

export default function Schools() {
  const t = useT();
  const { lang } = useI18n();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const sort = useSort<string>('name');

  const rows = useQuery({
    queryKey: ['platform-schools'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('platform_schools');
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const list = useMemo(() => {
    let out = rows.data ?? [];

    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((r) =>
        r.name.toLowerCase().includes(needle)
        || (r.tax_id ?? '').toLowerCase().includes(needle)
        || (r.phone ?? '').includes(needle));
    }

    if (filter === 'overdue')   out = out.filter((r) => (r.overdue_days ?? -1) >= 0);
    if (filter === 'trial')     out = out.filter((r) => r.status === 'trial');
    if (filter === 'restricted') out = out.filter((r) => r.status === 'restricted');
    if (filter === 'overlimit') out = out.filter((r) => r.over_limit);
    if (filter === 'pending')   out = out.filter((r) => r.pending_payments > 0);

    return sort.apply(out, (r, key) => (r as unknown as Record<string, unknown>)[key]);
  }, [rows.data, q, filter, sort]);

  if (rows.isLoading) return <Loading />;
  if (rows.error) {
    return <ErrorState message={(rows.error as Error).message}
                       onRetry={() => rows.refetch()} />;
  }

  const all = rows.data ?? [];

  return (
    <>
      <PageHeader
        title={t('schools.title')}
        subtitle={t('common.showing', { count: list.length })}
        actions={
          <>
            <Button onClick={() => exportTable('maktablar', EXPORT_COLUMNS(t), list)}>
              {t('common.export')}
            </Button>
            <Link to="/maktablar/yangi">
              <Button variant="primary">{t('schools.add')}</Button>
            </Link>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('schools.search')}
          className="w-64"
        />
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-auto min-w-[12rem]"
        >
          <option value="all">{t('schools.filterAll')} ({all.length})</option>
          <option value="overdue">
            {t('schools.filterOverdue')} ({all.filter((r) => (r.overdue_days ?? -1) >= 0).length})
          </option>
          <option value="pending">
            {t('schools.filterPending')} ({all.filter((r) => r.pending_payments > 0).length})
          </option>
          <option value="trial">
            {t('schools.filterTrial')} ({all.filter((r) => r.status === 'trial').length})
          </option>
          <option value="restricted">
            {t('schools.filterRestricted')} ({all.filter((r) => r.status === 'restricted').length})
          </option>
          <option value="overlimit">
            {t('schools.filterOverLimit')} ({all.filter((r) => r.over_limit).length})
          </option>
        </Select>
      </div>

      {list.length === 0 ? (
        <EmptyState title={t('schools.empty')} hint={t('schools.emptyHint')} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th><button onClick={() => sort.toggle('name')}>
                {t('schools.name')}{sort.indicator('name')}</button></Th>
              <Th>{t('schools.status')}</Th>
              <Th align="right"><button onClick={() => sort.toggle('students_count')}>
                {t('schools.students')}{sort.indicator('students_count')}</button></Th>
              <Th align="right"><button onClick={() => sort.toggle('branches_count')}>
                {t('schools.branches')}{sort.indicator('branches_count')}</button></Th>
              <Th align="right"><button onClick={() => sort.toggle('monthly_amount')}>
                {t('schools.monthly')}{sort.indicator('monthly_amount')}</button></Th>
              <Th><button onClick={() => sort.toggle('next_payment_date')}>
                {t('schools.nextPayment')}{sort.indicator('next_payment_date')}</button></Th>
              <Th align="right">{t('schools.unpaid')}</Th>
              <Th><button onClick={() => sort.toggle('last_activity')}>
                {t('schools.lastActivity')}{sort.indicator('last_activity')}</button></Th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const overdue = r.overdue_days ?? -1;
              return (
                <Tr
                  key={r.school_id}
                  className={r.status === 'restricted' ? 'bg-[var(--danger-bg)]' : ''}
                >
                  <Td>
                    <Link
                      to={`/maktablar/${r.school_id}`}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                    <span className="ml-1.5 inline-flex gap-1 align-middle">
                      {r.pending_payments > 0 && (
                        <Badge tone="warn">{t('schools.badgePending')}</Badge>
                      )}
                      {r.unread_messages > 0 && (
                        <Badge tone="brand">{r.unread_messages}</Badge>
                      )}
                    </span>
                    {r.tax_id && (
                      <span className="ml-1 text-[11px] text-[var(--text-faint)]">
                        {r.tax_id}
                      </span>
                    )}
                  </Td>

                  <Td>
                    <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>
                      {t(`status.${r.status}`)}
                    </Badge>
                  </Td>

                  {/* Chegaradan oshgan o'quvchi — sotuv imkoniyati.
                      Limit yonida ko'rsatiladi, taqqoslash oson bo'lsin. */}
                  <Td align="right" mono>
                    <span className={r.over_limit ? 'font-semibold text-[var(--warn)]' : ''}>
                      {r.students_count}
                    </span>
                    <span className="text-[var(--text-faint)]">
                      {' / '}{r.students_included}
                    </span>
                  </Td>

                  <Td align="right" mono>{r.branches_count}</Td>
                  <Td align="right"><Money value={r.monthly_amount} /></Td>

                  <Td mono>
                    {r.next_payment_date ? (
                      <span className={
                        overdue >= 45 ? 'font-semibold text-[var(--danger)]'
                        : overdue >= 30 ? 'text-[var(--danger)]'
                        : overdue >= 0 ? 'text-[var(--warn)]'
                        : ''
                      }>
                        {date(r.next_payment_date, lang)}
                        {overdue >= 0 && (
                          <span className="ml-1 text-[11px]">
                            (+{overdue}{t('schools.days')})
                          </span>
                        )}
                      </span>
                    ) : '—'}
                    {r.status === 'trial' && r.trial_ends_at && (
                      <span className="ml-1 text-[11px] text-[var(--text-faint)]">
                        {t('schools.trialUntil', { date: date(r.trial_ends_at, lang) })}
                      </span>
                    )}
                  </Td>

                  <Td align="right">
                    {Number(r.unpaid_amount ?? 0) > 0
                      ? <Money value={r.unpaid_amount} colored />
                      : <span className="text-[var(--text-faint)]">—</span>}
                  </Td>

                  <Td mono className="text-[var(--text-muted)]">
                    {r.last_activity ? date(r.last_activity, lang) : '—'}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <Td className="font-semibold">{t('common.total')}</Td>
              <Td />
              <Td align="right" mono className="font-semibold">
                {list.reduce((s, r) => s + r.students_count, 0)}
              </Td>
              <Td align="right" mono className="font-semibold">
                {list.reduce((s, r) => s + r.branches_count, 0)}
              </Td>
              <Td align="right" className="font-semibold">
                {money(list.reduce((s, r) => s + Number(r.monthly_amount ?? 0), 0), lang)}
              </Td>
              <Td />
              <Td align="right" className="font-semibold">
                {money(list.reduce((s, r) => s + Number(r.unpaid_amount ?? 0), 0), lang)}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </Table>
      )}
    </>
  );
}
