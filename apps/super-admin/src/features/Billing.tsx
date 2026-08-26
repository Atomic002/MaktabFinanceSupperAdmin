// =====================================================================
//  Obuna va to'lovlar (TZ E4).
//
//  Ikkita ro'yxat, ikkita vazifa:
//    1. KUTAYOTGAN CHEKLAR — maktab yuborgan, ko'rib chiqilishi kerak
//    2. HISOB-FAKTURALAR — chiqarilgan, to'lanmagan
//
//  Chek tasdiqlanganda obuna avtomatik uzaytiriladi va bloklangan
//  maktab darhol ishlashga qaytadi. Rad etilganda SABAB majburiy —
//  u maktabga yozishma orqali boradi.
//
//  Chek RASMI signed URL orqali ochiladi (5 daqiqa). Bucket yopiq,
//  havola vaqtinchalik — rasm hech qachon ochiq internetda turmaydi.
// =====================================================================

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { date, dateTime, money } from '@/lib/format';
import {
  Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, Money,
  Notice, PageHeader, Table, Td, Th, Tr,
} from '@/ui';
import { useToast } from '@/ui/Feedback';

type PaymentRow = {
  id: string;
  school_id: string;
  amount: number;
  paid_on: string;
  months: number;
  method: string;
  file_path: string | null;
  note: string | null;
  status: string;
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  schools: { name: string; status: string } | null;
};

export default function Billing() {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'pending' | 'history' | 'invoices'>('pending');
  const [reviewing, setReviewing] = useState<PaymentRow | null>(null);

  const payments = useQuery({
    queryKey: ['subscription-payments', tab],
    queryFn: async () => {
      let q = supabase
        .from('subscription_payments')
        .select('*, schools(name, status)')
        .order('created_at', { ascending: false });
      if (tab === 'pending') q = q.eq('status', 'pending');
      else q = q.neq('status', 'pending').limit(100);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PaymentRow[];
    },
    enabled: tab !== 'invoices',
  });

  const invoices = useQuery({
    queryKey: ['unpaid-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_invoices')
        .select('*, schools(name, status)')
        .in('status', ['unpaid', 'partial'])
        .order('due_date')
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: tab === 'invoices',
  });

  // Kunlik siklni qo'lda ishga tushirish. Cron kechikkan yoki sozlama
  // o'zgargandan keyin darhol qo'llash uchun kerak.
  const runCycle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('run_billing_cycle');
      if (error) throw error;
      return data as { invoiced: number; changed: number };
    },
    onSuccess: (d) => {
      toast.ok(t('billing.cycleDone', {
        invoiced: String(d.invoiced), changed: String(d.changed),
      }));
      qc.invalidateQueries();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pendingCount = useMemo(
    () => (tab === 'pending' ? payments.data?.length ?? 0 : undefined),
    [tab, payments.data],
  );

  return (
    <>
      <PageHeader
        title={t('billing.title')}
        subtitle={pendingCount !== undefined
          ? t('common.showing', { count: pendingCount }) : undefined}
        actions={
          <Button onClick={() => runCycle.mutate()} disabled={runCycle.isPending}>
            {runCycle.isPending ? t('billing.cycleRunning') : t('billing.runCycle')}
          </Button>
        }
      />

      <div className="mb-3 flex gap-1.5">
        {(['pending', 'history', 'invoices'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-[13px] ${
              tab === k
                ? 'bg-brand-900 font-medium text-white'
                : 'border bg-[var(--bg)] hover:bg-[var(--bg-inset)]'
            }`}
          >
            {t(`billing.tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'invoices' ? (
        invoices.isLoading ? <Loading /> : (invoices.data ?? []).length === 0 ? (
          <EmptyState title={t('billing.noUnpaid')} hint={t('billing.noUnpaidHint')} />
        ) : (
          <Card padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>{t('schools.name')}</Th>
                  <Th>{t('billing.period')}</Th>
                  <Th>{t('billing.due')}</Th>
                  <Th align="right">{t('billing.total')}</Th>
                  <Th align="right">{t('billing.paid')}</Th>
                  <Th align="right">{t('billing.left')}</Th>
                  <Th>{t('schools.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {(invoices.data ?? []).map((inv) => {
                  const due = new Date(inv.due_date as string);
                  const overdue = Math.floor((Date.now() - due.getTime()) / 86400000);
                  return (
                    <Tr key={inv.id as string}>
                      <Td>
                        <Link to={`/maktablar/${inv.school_id}`} className="hover:underline">
                          {(inv.schools as unknown as { name: string } | null)?.name}
                        </Link>
                      </Td>
                      <Td mono>{String(inv.period).slice(0, 7)}</Td>
                      <Td mono className={overdue >= 0 ? 'text-[var(--danger)]' : ''}>
                        {date(inv.due_date as string, lang)}
                        {overdue >= 0 && ` (+${overdue}${t('schools.days')})`}
                      </Td>
                      <Td align="right"><Money value={inv.total_amount as number} /></Td>
                      <Td align="right"><Money value={inv.paid_amount as number} /></Td>
                      <Td align="right">
                        <Money
                          value={Number(inv.total_amount) - Number(inv.paid_amount)}
                          colored
                        />
                      </Td>
                      <Td>
                        <Badge tone={inv.status === 'partial' ? 'warn' : 'danger'}>
                          {t(`invStatus.${inv.status}`)}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )
      ) : payments.isLoading ? <Loading /> : (payments.data ?? []).length === 0 ? (
        <EmptyState
          title={t(tab === 'pending' ? 'billing.noPending' : 'common.empty')}
          hint={t(tab === 'pending' ? 'billing.noPendingHint' : 'common.emptyHint')}
        />
      ) : (
        <Card padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>{t('billing.submitted')}</Th>
                <Th>{t('schools.name')}</Th>
                <Th align="right">{t('billing.amount')}</Th>
                <Th>{t('billing.paidOn')}</Th>
                <Th align="right">{t('billing.months')}</Th>
                <Th>{t('billing.method')}</Th>
                <Th>{t('schools.status')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {(payments.data ?? []).map((p) => (
                <Tr key={p.id}>
                  <Td mono>{dateTime(p.created_at, lang)}</Td>
                  <Td>
                    <Link to={`/maktablar/${p.school_id}`} className="hover:underline">
                      {p.schools?.name}
                    </Link>
                    {p.schools?.status === 'restricted' && (
                      <Badge tone="danger">{t('status.restricted')}</Badge>
                    )}
                  </Td>
                  <Td align="right"><Money value={p.amount} bold /></Td>
                  <Td mono>{date(p.paid_on, lang)}</Td>
                  <Td align="right" mono>{p.months}</Td>
                  <Td>{t(`method.${p.method}`)}</Td>
                  <Td>
                    <Badge tone={
                      p.status === 'confirmed' ? 'ok'
                      : p.status === 'rejected' ? 'danger' : 'warn'
                    }>
                      {t(`payStatus.${p.status}`)}
                    </Badge>
                    {p.reject_reason && (
                      <span className="ml-1 text-[11px] text-[var(--text-faint)]">
                        {p.reject_reason}
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    {p.status === 'pending' && (
                      <Button size="sm" variant="primary" onClick={() => setReviewing(p)}>
                        {t('billing.review')}
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {reviewing && (
        <ReviewModal
          payment={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => qc.invalidateQueries()}
        />
      )}
    </>
  );
}

// =====================================================================
//  Chekni ko'rib chiqish.
//
//  Rad etish uchun SABAB majburiy (baza ham talab qiladi). Sabab
//  maktabga yozishma orqali boradi — "rad etildi" deb qoldirib
//  ketish mumkin emas.
// =====================================================================

function ReviewModal({ payment, onClose, onDone }: {
  payment: PaymentRow; onClose: () => void; onDone: () => void;
}) {
  const t = useT();
  const { lang } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Chek rasmi — 5 daqiqalik vaqtinchalik havola.
  useQuery({
    queryKey: ['receipt-url', payment.id],
    enabled: !!payment.file_path,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('subscription-receipts')
        .createSignedUrl(payment.file_path!, 300);
      if (error) throw error;
      setFileUrl(data.signedUrl);
      return data.signedUrl;
    },
  });

  const review = useMutation({
    mutationFn: async (approve: boolean) => {
      const { data, error } = await supabase.rpc('review_subscription_payment', {
        p_payment_id: payment.id,
        p_approve: approve,
        p_reason: approve ? undefined : reason.trim(),
      });
      if (error) throw error;
      return data as { next_payment_date?: string };
    },
    onSuccess: (d, approve) => {
      toast.ok(approve
        ? t('billing.approved', { date: d.next_payment_date ?? '' })
        : t('billing.rejected'));
      onDone();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open wide title={t('billing.reviewTitle')} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="danger"
          disabled={reason.trim().length < 5 || review.isPending}
          onClick={() => review.mutate(false)}
        >
          {t('billing.reject')}
        </Button>
        <Button
          variant="accent"
          disabled={review.isPending}
          onClick={() => review.mutate(true)}
        >
          {t('billing.approve')}
        </Button>
      </>
    }>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 text-[13px]">
          <div className="flex justify-between border-b py-1">
            <span className="text-[var(--text-muted)]">{t('schools.name')}</span>
            <span className="font-medium">{payment.schools?.name}</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-[var(--text-muted)]">{t('billing.amount')}</span>
            <span className="font-semibold">{money(payment.amount, lang)}</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-[var(--text-muted)]">{t('billing.paidOn')}</span>
            <span>{date(payment.paid_on, lang)}</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-[var(--text-muted)]">{t('billing.method')}</span>
            <span>{t(`method.${payment.method}`)}</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-[var(--text-muted)]">{t('billing.months')}</span>
            <span className="num">{payment.months}</span>
          </div>
          {payment.note && (
            <div className="border-b py-1">
              <span className="text-[var(--text-muted)]">{t('billing.note')}: </span>
              {payment.note}
            </div>
          )}

          <Field label={t('billing.rejectReason')} hint={t('billing.rejectHint')}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>

          <Notice tone="brand">{t('billing.approveHint')}</Notice>
        </div>

        <div>
          {payment.file_path ? (
            fileUrl ? (
              payment.file_path.toLowerCase().endsWith('.pdf') ? (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full">{t('billing.openPdf')}</Button>
                </a>
              ) : (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={fileUrl}
                    alt={t('billing.receipt')}
                    className="max-h-96 w-full rounded-md border object-contain"
                  />
                </a>
              )
            ) : <Loading />
          ) : (
            <Notice tone="warn">{t('billing.noReceipt')}</Notice>
          )}
        </div>
      </div>

      {/* Oylar sonini bu yerda TUZATIB BO'LMAYDI — uni maktab
          yuborishda belgilaydi va `review_subscription_payment` aynan
          o'shani ishlatadi. Noto'g'ri bo'lsa chek rad etiladi yoki
          to'lov kartochkadan qo'lda belgilanadi. Tahrirlanadigan
          maydon qo'yish yolg'on bo'lardi: o'zgartirilgan qiymat
          serverga umuman bormaydi. */}
    </Modal>
  );
}
