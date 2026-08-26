// =====================================================================
//  Platforma ko'rsatkichlari (TZ E7).
//
//  Bu ekran bitta savolga javob beradi: "bugun nima qilishim kerak".
//  Shuning uchun eng tepada KUTAYOTGAN ISHLAR turadi — tasdiqlanmagan
//  chek va o'qilmagan xabar. Umumiy statistika undan pastda: u
//  qiziqarli, lekin shoshilinch emas.
// =====================================================================

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { money } from '@/lib/format';
import {
  Badge, Button, Card, ErrorState, Loading, Money, Notice,
  PageHeader, Table, Td, Th, Tr,
} from '@/ui';

/** Katta raqam + izoh. Buxgalter jadvalidan farqli — bu ko'rinish. */
function Stat({ label, value, tone, hint }: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'danger';
  hint?: string;
}) {
  const color = tone === 'danger' ? 'text-[var(--danger)]'
    : tone === 'warn' ? 'text-[var(--warn)]'
    : tone === 'ok' ? 'text-[var(--ok)]'
    : 'text-[var(--text)]';
  return (
    <div className="rounded-lg border bg-[var(--bg)] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`num mt-0.5 text-xl font-semibold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">{hint}</p>}
    </div>
  );
}

export default function Overview() {
  const t = useT();
  const { lang } = useI18n();

  const overview = useQuery({
    queryKey: ['platform-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('platform_overview');
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const revenue = useQuery({
    queryKey: ['platform-revenue', 12],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('platform_revenue', { p_months: 12 });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (overview.isLoading) return <Loading />;
  if (overview.error) {
    return <ErrorState message={(overview.error as Error).message}
                       onRetry={() => overview.refetch()} />;
  }

  const o = overview.data;
  if (!o) return <ErrorState message={t('common.error')} />;

  const rows = revenue.data ?? [];
  // Grafik uchun eng katta qiymat — ustunlar shunga nisbatan.
  const peak = Math.max(1, ...rows.map((r) => Number(r.issued ?? 0)));

  return (
    <>
      <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} />

      {/* --- Kutayotgan ishlar. Eng tepada, chunki bu — bugungi ish --- */}
      {(o.pending_payments > 0 || o.unread_threads > 0 || o.overdue_schools > 0) && (
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {o.pending_payments > 0 && (
            <Link to="/tolovlar">
              <Notice tone="warn">
                <span className="font-semibold">{o.pending_payments}</span>
                {' '}{t('overview.pendingPayments')}
              </Notice>
            </Link>
          )}
          {o.unread_threads > 0 && (
            <Link to="/murojaatlar">
              <Notice tone="brand">
                <span className="font-semibold">{o.unread_threads}</span>
                {' '}{t('overview.unreadThreads')}
              </Notice>
            </Link>
          )}
          {o.overdue_schools > 0 && (
            <Link to="/maktablar">
              <Notice tone="danger">
                <span className="font-semibold">{o.overdue_schools}</span>
                {' '}{t('overview.overdueSchools')}
              </Notice>
            </Link>
          )}
        </div>
      )}

      {/* --- Pul --------------------------------------------------- */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t('overview.mrr')}
          value={money(o.mrr, lang)}
          tone="ok"
          hint={t('overview.mrrHint')}
        />
        <Stat
          label={t('overview.unpaid')}
          value={money(o.unpaid_amount, lang)}
          tone={Number(o.unpaid_amount) > 0 ? 'danger' : undefined}
          hint={t('overview.unpaidHint', { count: o.unpaid_invoices })}
        />
        <Stat
          label={t('overview.schoolsPaying')}
          value={String(o.schools_active)}
          hint={t('overview.ofTotal', { total: o.schools_total })}
        />
        <Stat
          label={t('overview.newSchools')}
          value={String(o.new_schools_30d)}
          hint={t('overview.last30')}
        />
      </div>

      {/* --- Maktablar holati bo'yicha ------------------------------ */}
      <Card title={t('overview.byStatus')} className="mb-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{t('status.trial')}: {o.schools_trial}</Badge>
          <Badge tone="ok">{t('status.active')}: {o.schools_active}</Badge>
          <Badge tone="danger">{t('status.restricted')}: {o.schools_restricted}</Badge>
          <Badge>{t('status.archived')}: {o.schools_archived}</Badge>
        </div>
      </Card>

      {/* --- Tizim yuki --------------------------------------------- */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('overview.students')} value={String(o.students_total)} />
        <Stat label={t('overview.branches')} value={String(o.branches_total)} />
        <Stat label={t('overview.users')} value={String(o.users_total)} />
        <Stat
          label={t('overview.failedMessages')}
          value={String(o.failed_messages)}
          tone={o.failed_messages > 0 ? 'warn' : undefined}
          hint={t('overview.failedHint')}
        />
      </div>

      {/* --- Daromad dinamikasi -------------------------------------- */}
      <Card title={t('overview.revenue')} padded={false}>
        {revenue.isLoading ? <Loading /> : (
          <Table>
            <thead>
              <tr>
                <Th>{t('overview.month')}</Th>
                <Th align="right">{t('overview.issued')}</Th>
                <Th align="right">{t('overview.collected')}</Th>
                <Th align="right">{t('overview.invoices')}</Th>
                {/* Oddiy ustunli grafik — kutubxonasiz. Nisbat ko'rinsa
                    yetarli, aniq raqam yonidagi ustunda turibdi. */}
                <Th className="w-40">{t('overview.chart')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const issued = Number(r.issued ?? 0);
                const collected = Number(r.collected ?? 0);
                return (
                  <Tr key={String(r.period)}>
                    <Td mono>{String(r.period).slice(0, 7)}</Td>
                    <Td align="right"><Money value={issued} /></Td>
                    <Td align="right">
                      <span className={collected < issued
                        ? 'text-[var(--warn)]' : 'text-[var(--ok)]'}>
                        <Money value={collected} />
                      </span>
                    </Td>
                    <Td align="right" mono>{r.invoices}</Td>
                    <Td>
                      <span className="flex h-3 w-full overflow-hidden rounded-sm
                        bg-[var(--bg-inset)]" title={`${money(collected, lang)} / ${money(issued, lang)}`}>
                        <span
                          className="bg-accent-500"
                          style={{ width: `${Math.round((collected / peak) * 100)}%` }}
                        />
                        <span
                          className="bg-[var(--border)]"
                          style={{ width: `${Math.round(((issued - collected) / peak) * 100)}%` }}
                        />
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-4 flex gap-2">
        <Link to="/maktablar/yangi">
          <Button variant="primary">{t('schools.add')}</Button>
        </Link>
        <Link to="/maktablar">
          <Button>{t('nav.schools')}</Button>
        </Link>
      </div>
    </>
  );
}
