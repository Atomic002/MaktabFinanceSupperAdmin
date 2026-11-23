// =====================================================================
//  Platforma ko'rsatkichlari (TZ E7).
//
//  Bitta savol: "bugun nima qilishim kerak va platforma qanday?".
//  Tepada — kutayotgan ishlar (faqat bor bo'lsa), keyin to'rtta asosiy
//  raqam, maktablar holati bitta chiziqda va 12 oylik daromad grafigi.
//  Jadval va izoh matnlari yo'q — raqamning o'zi gapiradi.
// =====================================================================

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { money } from '@/lib/format';
import { Button, Card, ErrorState, Loading, PageHeader, Stat } from '@/ui';

const MONTHS: Record<string, string[]> = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  'uz-cyrl': ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
};

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

  const rows = [...(revenue.data ?? [])]
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const peak = Math.max(1, ...rows.map((r) => Number(r.issued ?? 0)));

  const tasks = [
    { n: o.pending_payments, to: '/tolovlar', label: t('overview.pendingPayments'), tone: 'warn' },
    { n: o.unread_threads, to: '/murojaatlar', label: t('overview.unreadThreads'), tone: 'brand' },
    { n: o.overdue_schools, to: '/maktablar?f=overdue', label: t('overview.overdueSchools'), tone: 'danger' },
  ].filter((x) => Number(x.n) > 0);

  const status = [
    { key: 'trial', n: Number(o.schools_trial), color: 'bg-sky-500' },
    { key: 'active', n: Number(o.schools_active), color: 'bg-accent-500' },
    { key: 'restricted', n: Number(o.schools_restricted), color: 'bg-[var(--danger)]' },
    { key: 'archived', n: Number(o.schools_archived), color: 'bg-[var(--text-faint)]' },
  ];
  const statusTotal = Math.max(1, status.reduce((a, s) => a + s.n, 0));

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        actions={
          <Link to="/maktablar/yangi">
            <Button variant="primary">+ {t('schools.add')}</Button>
          </Link>
        }
      />

      {/* --- Kutayotgan ishlar — faqat bor bo'lsa ------------------ */}
      {tasks.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {tasks.map((x) => (
            <Link key={x.to} to={x.to}
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px]
                    hover:bg-[var(--bg-inset)] ${
                    x.tone === 'danger' ? 'border-[var(--danger)] text-[var(--danger)]'
                    : x.tone === 'warn' ? 'border-[var(--warn)] text-[var(--warn)]'
                    : 'bg-[var(--bg)]'}`}>
              <span className="num font-semibold">{x.n}</span>
              {x.label}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* --- Asosiy raqamlar --------------------------------------- */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('overview.mrr')} value={money(o.mrr, lang)} tone="ok"
              hint={t('overview.mrrHint')} />
        <Stat label={t('overview.unpaid')} value={money(o.unpaid_amount, lang)}
              tone={Number(o.unpaid_amount) > 0 ? 'danger' : 'neutral'}
              hint={t('overview.unpaidHint', { count: o.unpaid_invoices })} />
        <Stat label={t('overview.schoolsPaying')} value={String(o.schools_active)}
              hint={`${t('overview.ofTotal', { total: o.schools_total })} · +${o.new_schools_30d} ${t('overview.last30')}`} />
        <Stat label={t('overview.students')} value={money(o.students_total, lang)}
              hint={`${t('overview.branches')}: ${o.branches_total} · ${t('overview.users')}: ${o.users_total}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Daromad: 12 oy ------------------------------------- */}
        <Card title={t('overview.revenue')} className="lg:col-span-2">
          {revenue.isLoading ? <Loading /> : rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[var(--text-faint)]">—</div>
          ) : (
            <div className="flex h-56 items-end gap-1.5 pt-6">
              {rows.map((r) => {
                const issued = Number(r.issued ?? 0);
                const collected = Number(r.collected ?? 0);
                const m = Number(String(r.period).slice(5, 7)) - 1;
                return (
                  <div key={String(r.period)} className="group relative flex h-full flex-1 flex-col justify-end">
                    <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2
                      -translate-y-full whitespace-nowrap rounded-lg border bg-[var(--bg)] px-2.5 py-1.5
                      text-[12px] shadow-[var(--shadow-pop)] group-hover:block">
                      <div className="num font-semibold text-[var(--ok)]">{money(collected, lang)}</div>
                      <div className="num text-[var(--text-faint)]">/ {money(issued, lang)}</div>
                    </div>
                    <div className="relative w-full overflow-hidden rounded-t-md bg-[var(--bg-inset)]"
                         style={{ height: `${Math.max(2, (issued / peak) * 100)}%` }}>
                      <div className="absolute inset-x-0 bottom-0 bg-accent-500"
                           style={{ height: issued > 0 ? `${Math.min(100, (collected / issued) * 100)}%` : '0%' }} />
                    </div>
                    <div className="mt-1.5 text-center text-[11px] text-[var(--text-faint)]">
                      {(MONTHS[lang] ?? MONTHS.uz)[m]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* --- Maktablar holati ----------------------------------- */}
        <Card title={t('overview.byStatus')}>
          <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--bg-inset)]">
            {status.map((s) => s.n > 0 && (
              <div key={s.key} className={s.color} style={{ width: `${(s.n / statusTotal) * 100}%` }} />
            ))}
          </div>
          <div className="space-y-2.5">
            {status.map((s) => (
              <Link key={s.key} to={s.key === 'trial' || s.key === 'restricted' ? `/maktablar?f=${s.key}` : '/maktablar'}
                    className="flex items-center gap-2.5 text-[13.5px] hover:underline">
                <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                <span className="flex-1 text-[var(--text-muted)]">{t(`status.${s.key}`)}</span>
                <span className="num font-semibold">{s.n}</span>
              </Link>
            ))}
          </div>
          {Number(o.failed_messages) > 0 && (
            <div className="mt-4 border-t pt-3 text-[12.5px] text-[var(--warn)]">
              {t('overview.failedMessages')}: <span className="num font-semibold">{o.failed_messages}</span>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
