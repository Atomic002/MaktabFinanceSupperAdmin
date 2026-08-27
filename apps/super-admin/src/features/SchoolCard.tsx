// =====================================================================
//  Maktab kartochkasi (TZ E2) va texnik yordam sessiyasi (TZ E5).
//
//  KO'RSATILADI: o'lcham, holat, obuna, narx tarkibi, FAOLLIK
//  SANALARI va shu maktab bo'yicha platforma jurnali.
//
//  KO'RSATILMAYDI: o'quvchi ismi, qarzdorlik, to'lov summasi,
//  hisoblanma — mijozning ichki moliyasi. Faollik bo'limida ataylab
//  faqat SANALAR bor: "oxirgi to'lov 12.08.2026" — lekin qancha
//  ekani yo'q (TZ E2: "sanalar, summalar emas").
//
//  Ichki moliyani ko'rishning YAGONA yo'li — texnik yordam sessiyasi,
//  u esa ikkita jurnalga tushadi va maktab direktoriga ko'rinadi.
// =====================================================================

import { type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callPlatformOps, SCHOOL_PANEL_URL, supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { detailText } from '@/lib/detail';
import { date, dateTime, money } from '@/lib/format';
import {
  Badge, Button, Card, ErrorState, Field, Input, Loading, Modal, Money,
  Notice, PageHeader, Select, Table, Td, Th, Tr,
} from '@/ui';
import { useConfirm, useToast } from '@/ui/Feedback';

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'brand' | 'neutral'> = {
  trial: 'brand', active: 'ok', restricted: 'danger',
  archived: 'neutral',
};

/** Ikki ustunli ma'lumot qatori — kartochkada ko'p ishlatiladi. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--border-soft)] py-1.5 last:border-0">
      <span className="text-[13px] text-[var(--text-muted)]">{label}</span>
      <span className="text-[13px] font-medium">{children}</span>
    </div>
  );
}

export default function SchoolCard() {
  const { id = '' } = useParams();
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [impersonating, setImpersonating] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [recording, setRecording] = useState(false);
  const [resetting, setResetting] = useState(false);

  const card = useQuery({
    queryKey: ['school-card', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('platform_school_card', {
        p_school_id: id,
      });
      if (error) throw error;
      return data as Record<string, never>;
    },
  });

  const subscription = useQuery({
    queryKey: ['school-subscription', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_subscriptions')
        .select('*, plans(code, name, max_students, max_branches)')
        .eq('school_id', id)
        .neq('status', 'cancelled')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const invoices = useQuery({
    queryKey: ['school-invoices', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_invoices')
        .select('*')
        .eq('school_id', id)
        .order('period', { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

  const log = useQuery({
    queryKey: ['school-log', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_log')
        .select('id, action, entity, at, before, after')
        .eq('school_id', id)
        .order('at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sessions = useQuery({
    queryKey: ['school-sessions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impersonation_sessions')
        .select('id, mode, reason, started_at, expires_at, ended_at')
        .eq('school_id', id)
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['school-card', id] });
    qc.invalidateQueries({ queryKey: ['school-subscription', id] });
    qc.invalidateQueries({ queryKey: ['school-invoices', id] });
    qc.invalidateQueries({ queryKey: ['school-log', id] });
    qc.invalidateQueries({ queryKey: ['platform-schools'] });
  };

  // --- Hisob-faktura chiqarish ------------------------------------
  const issue = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('issue_subscription_invoice', {
        p_school_id: id,
      });
      if (error) throw error;
      return data as { created: boolean };
    },
    onSuccess: (d) => {
      toast[d.created ? 'ok' : 'info'](
        d.created ? t('billing.invoiceIssued') : t('billing.invoiceExists'),
      );
      refreshAll();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (card.isLoading) return <Loading />;
  if (card.error) {
    return <ErrorState message={(card.error as Error).message}
                       onRetry={() => card.refetch()} />;
  }

  const c = card.data as unknown as {
    school: Record<string, string | null>;
    size: Record<string, number>;
    activity: Record<string, string | null>;
    price: Record<string, number | boolean>;
    director: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  };

  const sub = subscription.data as Record<string, never> | null;
  const overdue = sub?.next_payment_date
    ? Math.floor(
        (Date.now() - new Date(sub.next_payment_date as unknown as string).getTime())
        / 86400000)
    : null;

  return (
    <>
      <PageHeader
        title={c.school.name ?? ''}
        subtitle={c.school.tax_id ? `${t('schools.taxId')}: ${c.school.tax_id}` : undefined}
        actions={
          <>
            <Link to="/maktablar"><Button>{t('common.back')}</Button></Link>
            <Button onClick={() => setChangingPlan(true)}>{t('school.changePlan')}</Button>
            <Button onClick={() => setChangingStatus(true)}>{t('school.changeStatus')}</Button>
            <Button variant="accent" onClick={() => setRecording(true)}>
              {t('school.recordPayment')}
            </Button>
            <Button variant="primary" onClick={() => setImpersonating(true)}>
              {t('school.support')}
            </Button>
          </>
        }
      />

      {c.school.status === 'restricted' && (
        <Notice tone="danger">{t('school.restrictedNotice')}</Notice>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {/* --- Asosiy ma'lumot ------------------------------------- */}
        <Card title={t('school.info')}>
          <Row label={t('schools.status')}>
            <Badge tone={STATUS_TONE[c.school.status ?? ''] ?? 'neutral'}>
              {t(`status.${c.school.status}`)}
            </Badge>
          </Row>
          <Row label={t('school.legalName')}>{c.school.legal_name ?? '—'}</Row>
          <Row label={t('schools.taxId')}>{c.school.tax_id ?? '—'}</Row>
          <Row label={t('school.address')}>{c.school.address ?? '—'}</Row>
          <Row label={t('schools.phone')}>{c.school.phone ?? '—'}</Row>
          <Row label={t('school.email')}>{c.school.email ?? '—'}</Row>
          <Row label={t('school.director')}>
            {c.director?.full_name ?? '—'}
            {/*  Parolni tiklash — eng ko'p uchraydigan yordam so'rovi.
                 Shuning uchun u direktor nomi yonida turadi, alohida
                 ekranda emas. */}
            {c.director && (
              <button
                onClick={() => setResetting(true)}
                className="ml-2 text-[12px] text-[var(--text-muted)] underline
                  underline-offset-2 hover:text-[var(--text)]"
              >
                {t('school.resetPassword')}
              </button>
            )}
            {c.director?.email && (
              <span className="ml-1 text-[var(--text-faint)]">{c.director.email}</span>
            )}
          </Row>
          <Row label={t('school.createdAt')}>{date(c.school.created_at, lang)}</Row>
        </Card>

        {/* --- O'lcham --------------------------------------------- */}
        <Card title={t('school.size')}>
          <Row label={t('schools.students')}>
            {c.size.students} <span className="text-[var(--text-faint)]">
              / {String(c.price.students_included)}
            </span>
          </Row>
          <Row label={t('school.studentsAll')}>{c.size.students_all}</Row>
          <Row label={t('schools.branches')}>{c.size.branches}</Row>
          <Row label={t('school.classes')}>{c.size.classes}</Row>
          <Row label={t('school.teachers')}>{c.size.teachers}</Row>
          <Row label={t('school.users')}>{c.size.users}</Row>
        </Card>

        {/* --- Faollik. FAQAT SANALAR (TZ E2) ---------------------- */}
        <Card title={t('school.activity')}>
          <Row label={t('school.lastSignIn')}>
            {c.activity.last_sign_in ? dateTime(c.activity.last_sign_in, lang) : '—'}
          </Row>
          <Row label={t('school.lastAudit')}>
            {c.activity.last_audit ? dateTime(c.activity.last_audit, lang) : '—'}
          </Row>
          <Row label={t('school.lastInvoice')}>
            {c.activity.last_invoice ? date(c.activity.last_invoice, lang) : '—'}
          </Row>
          <Row label={t('school.lastPayment')}>
            {c.activity.last_payment ? date(c.activity.last_payment, lang) : '—'}
          </Row>
          <p className="mt-2 text-[11px] text-[var(--text-faint)]">
            {t('school.activityHint')}
          </p>
        </Card>
      </div>

      {/* --- Obuna va narx tarkibi -------------------------------- */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title={t('school.subscription')}>
          <Row label={t('schools.plan')}>
            {(sub?.plans as unknown as { name: string } | null)?.name ?? '—'}
          </Row>
          <Row label={t('school.subStatus')}>
            {sub ? t(`subStatus.${sub.status}`) : '—'}
          </Row>
          <Row label={t('schools.monthly')}>
            <Money value={sub?.monthly_amount ?? 0} />
          </Row>
          <Row label={t('school.trialEnds')}>
            {sub?.trial_ends_at ? date(sub.trial_ends_at, lang) : '—'}
          </Row>
          <Row label={t('schools.nextPayment')}>
            <span className={overdue !== null && overdue >= 0 ? 'text-[var(--danger)]' : ''}>
              {sub?.next_payment_date ? date(sub.next_payment_date, lang) : '—'}
              {overdue !== null && overdue >= 0 && ` (+${overdue}${t('schools.days')})`}
            </span>
          </Row>
          <Row label={t('school.lastPaid')}>
            {sub?.last_paid_at ? date(sub.last_paid_at, lang) : '—'}
          </Row>
        </Card>

        {/* Narx tarkibi — direktor bilan gaplashganda "nega shuncha"
            degan savolga darhol javob berish uchun. */}
        <Card title={t('school.priceBreakdown')}>
          <Row label={t('price.base')}>
            <Money value={c.price.base_amount as number} />
          </Row>
          <Row label={t('price.branches', {
            count: String(c.price.branches_extra),
          })}>
            <Money value={c.price.branches_amount as number} />
          </Row>
          <Row label={t('price.students', {
            steps: String(c.price.students_extra_steps),
            extra: String(c.price.students_extra),
          })}>
            <Money value={c.price.students_amount as number} />
          </Row>
          <div className="mt-2 flex justify-between border-t pt-2">
            <span className="text-sm font-semibold">{t('price.monthlyTotal')}</span>
            <span className="text-sm font-semibold">
              <Money value={c.price.monthly_total as number} bold />
            </span>
          </div>
          {Number(c.price.setup_fee) > 0 && (
            <Notice tone="brand">
              {t('price.setupPending', { amount: money(c.price.setup_fee as number, lang) })}
            </Notice>
          )}
        </Card>
      </div>

      {/* --- Hisob-fakturalar ------------------------------------- */}
      <Card
        title={t('school.invoices')}
        className="mt-3"
        padded={false}
        action={
          <Button size="sm" onClick={() => issue.mutate()} disabled={issue.isPending}>
            {t('billing.issueInvoice')}
          </Button>
        }
      >
        {invoices.isLoading ? <Loading /> : (invoices.data ?? []).length === 0 ? (
          <p className="p-4 text-[13px] text-[var(--text-muted)]">{t('school.noInvoices')}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('billing.period')}</Th>
                <Th>{t('billing.due')}</Th>
                <Th align="right">{t('billing.total')}</Th>
                <Th align="right">{t('billing.paid')}</Th>
                <Th>{t('schools.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {(invoices.data ?? []).map((inv) => (
                <Tr key={inv.id as string}>
                  <Td mono>{String(inv.period).slice(0, 7)}</Td>
                  <Td mono>{date(inv.due_date as string, lang)}</Td>
                  <Td align="right"><Money value={inv.total_amount as number} /></Td>
                  <Td align="right"><Money value={inv.paid_amount as number} /></Td>
                  <Td>
                    <Badge tone={
                      inv.status === 'paid' ? 'ok'
                      : inv.status === 'partial' ? 'warn'
                      : inv.status === 'void' ? 'neutral' : 'danger'
                    }>
                      {t(`invStatus.${inv.status}`)}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* --- Texnik yordam sessiyalari ---------------------------- */}
      <Card title={t('school.sessions')} className="mt-3" padded={false}>
        {(sessions.data ?? []).length === 0 ? (
          <p className="p-4 text-[13px] text-[var(--text-muted)]">{t('school.noSessions')}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('imp.started')}</Th>
                <Th>{t('imp.mode')}</Th>
                <Th>{t('imp.reason')}</Th>
                <Th>{t('imp.ended')}</Th>
              </tr>
            </thead>
            <tbody>
              {(sessions.data ?? []).map((s) => (
                <Tr key={s.id as string}>
                  <Td mono>{dateTime(s.started_at as string, lang)}</Td>
                  <Td>
                    <Badge tone={s.mode === 'write' ? 'danger' : 'neutral'}>
                      {t(`imp.${s.mode}`)}
                    </Badge>
                  </Td>
                  <Td className="max-w-md truncate">{s.reason ?? '—'}</Td>
                  <Td mono>
                    {s.ended_at
                      ? dateTime(s.ended_at as string, lang)
                      : <Badge tone="warn">{t('imp.open')}</Badge>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* --- Platforma jurnali ------------------------------------ */}
      <Card title={t('school.log')} className="mt-3" padded={false}>
        {(log.data ?? []).length === 0 ? (
          <p className="p-4 text-[13px] text-[var(--text-muted)]">{t('common.empty')}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('journal.at')}</Th>
                <Th>{t('journal.action')}</Th>
                <Th>{t('journal.detail')}</Th>
              </tr>
            </thead>
            <tbody>
              {(log.data ?? []).map((l) => (
                <Tr key={String(l.id)}>
                  <Td mono>{dateTime(l.at as string, lang)}</Td>
                  <Td>{t(`action.${l.action}`)}</Td>
                  <Td className="max-w-lg text-[12px] text-[var(--text-muted)]">
                    {detailText(t, l.after) ?? '—'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {impersonating && (
        <ImpersonateModal
          schoolId={id}
          schoolName={c.school.name ?? ''}
          onClose={() => setImpersonating(false)}
        />
      )}
      {changingStatus && (
        <StatusModal
          schoolId={id}
          current={c.school.status ?? ''}
          onClose={() => setChangingStatus(false)}
          onDone={refreshAll}
          confirm={confirm}
        />
      )}
      {changingPlan && (
        <PlanModal
          schoolId={id}
          onClose={() => setChangingPlan(false)}
          onDone={refreshAll}
        />
      )}
      {resetting && c.director && (
        <ResetPasswordModal
          schoolId={id}
          user={c.director}
          onClose={() => setResetting(false)}
        />
      )}
      {recording && (
        <RecordPaymentModal
          schoolId={id}
          suggested={Number(c.price.monthly_total)}
          onClose={() => setRecording(false)}
          onDone={refreshAll}
        />
      )}
    </>
  );
}

// =====================================================================
//  TEXNIK YORDAM SESSIYASI (TZ E5)
//
//  Eng nozik oyna. Uchta himoya:
//    1. sabab MAJBURIY, kamida 10 belgi — tugma shungacha o'chiq
//    2. `write` rejimi QO'SHIMCHA tasdiqlash talab qiladi
//    3. muddat 15/30/60 daqiqa, standart 30
//
//  Sessiya ochilgandan keyin maktab paneli YANGI OYNADA ochiladi va
//  token hash orqali beriladi. Bu super adminning O'Z sessiyasini
//  saqlab qoladi — aks holda u o'z panelidan chiqib ketardi.
// =====================================================================

function ImpersonateModal({ schoolId, schoolName, onClose }: {
  schoolId: string; schoolName: string; onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [userId, setUserId] = useState('');
  const [mode, setMode] = useState<'read' | 'write'>('read');
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [confirmWrite, setConfirmWrite] = useState(false);

  const users = useQuery({
    queryKey: ['school-users', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('school_users', {
        p_school_id: schoolId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      return await callPlatformOps<{
        access_token: string; refresh_token: string; expires_in: number;
      }>({
        action: 'impersonate',
        school_id: schoolId,
        target_user_id: userId,
        mode,
        reason: reason.trim(),
        minutes,
      });
    },
    onSuccess: (d) => {
      // Maktab paneli YANGI OYNADA. Token hash fragmentida — u
      // serverga YUBORILMAYDI va brauzer tarixida saqlanmaydi.
      const url = `${SCHOOL_PANEL_URL}/#access_token=${d.access_token}`
        + `&refresh_token=${d.refresh_token}`
        + `&expires_in=${d.expires_in}&token_type=bearer&type=magiclink`;
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.ok(t('imp.opened'));
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const reasonOk = reason.trim().length >= 10;
  const canStart = userId && reasonOk && (mode === 'read' || confirmWrite);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (canStart) start.mutate();
  }

  return (
    <Modal open title={t('imp.title')} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant={mode === 'write' ? 'danger' : 'primary'}
          disabled={!canStart || start.isPending}
          onClick={() => start.mutate()}
        >
          {start.isPending ? t('imp.opening') : t('imp.start')}
        </Button>
      </>
    }>
      <form onSubmit={onSubmit} className="space-y-3">
        <Notice tone="warn">{t('imp.warning', { school: schoolName })}</Notice>

        <Field label={t('imp.user')} required>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">{t('imp.pickUser')}</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id as string} value={u.id as string} disabled={!u.is_active}>
                {u.full_name} — {t(`role.${u.role}`)}
                {!u.is_active ? ` (${t('imp.inactive')})` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('imp.mode')}>
          <Select value={mode} onChange={(e) => {
            setMode(e.target.value as 'read' | 'write');
            setConfirmWrite(false);
          }}>
            <option value="read">{t('imp.read')}</option>
            <option value="write">{t('imp.write')}</option>
          </Select>
        </Field>

        {mode === 'write' && (
          <div className="rounded-md border border-[var(--danger)] p-2.5">
            <p className="text-[13px] text-[var(--danger)]">{t('imp.writeWarning')}</p>
            <label className="mt-2 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={confirmWrite}
                onChange={(e) => setConfirmWrite(e.target.checked)}
              />
              {t('imp.writeConfirm')}
            </label>
          </div>
        )}

        <Field
          label={t('imp.reason')}
          hint={reasonOk ? undefined : t('imp.reasonHint')}
          error={reason.length > 0 && !reasonOk ? t('imp.reasonShort') : undefined}
          required
        >
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('imp.reasonPlaceholder')}
            required
          />
        </Field>

        <Field label={t('imp.duration')}>
          <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            <option value={15}>15 {t('imp.minutes')}</option>
            <option value={30}>30 {t('imp.minutes')}</option>
            <option value={60}>60 {t('imp.minutes')}</option>
          </Select>
        </Field>

        <p className="text-[11px] text-[var(--text-faint)]">{t('imp.logged')}</p>
      </form>
    </Modal>
  );
}

// --- Maktab holatini o'zgartirish -----------------------------------
function StatusModal({ schoolId, current, onClose, onDone, confirm }: {
  schoolId: string; current: string; onClose: () => void; onDone: () => void;
  confirm: (o: { title?: string; message: string; warning?: string; danger?: boolean }) => Promise<boolean>;
}) {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState(current);
  const [reason, setReason] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('set_school_status', {
        p_school_id: schoolId,
        p_status: status as 'trial' | 'active' | 'restricted' | 'archived',
        p_reason: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.ok(t('ux.saved')); onDone(); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  async function submit() {
    // Arxivlash va bloklash — qaytarish qiyin qarorlar (TZ M2).
    if (status === 'archived' || status === 'restricted') {
      const ok = await confirm({
        title: t('school.confirmTitle'),
        message: t(status === 'archived' ? 'school.confirmArchive' : 'school.confirmRestrict'),
        danger: true,
      });
      if (!ok) return;
    }
    save.mutate();
  }

  return (
    <Modal open title={t('school.changeStatus')} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="primary"
          disabled={reason.trim().length < 5 || status === current || save.isPending}
          onClick={submit}
        >
          {t('common.save')}
        </Button>
      </>
    }>
      <div className="space-y-3">
        <Field label={t('schools.status')}>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {['trial', 'active', 'restricted', 'archived'].map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('school.reason')} hint={t('school.reasonHint')} required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
        </Field>
        <Notice tone="warn">{t('school.statusHint')}</Notice>
      </div>
    </Modal>
  );
}

// --- Tarifni o'zgartirish -------------------------------------------
function PlanModal({ schoolId, onClose, onDone }: {
  schoolId: string; onClose: () => void; onDone: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');

  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans').select('code, name, max_students, max_branches')
        .eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('set_school_plan', {
        p_school_id: schoolId, p_plan_code: code, p_reason: reason.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.ok(t('ux.saved')); onDone(); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open title={t('school.changePlan')} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={!code || save.isPending}
                onClick={() => save.mutate()}>
          {t('common.save')}
        </Button>
      </>
    }>
      <div className="space-y-3">
        <Field label={t('schools.plan')} required>
          <Select value={code} onChange={(e) => setCode(e.target.value)} required>
            <option value="">{t('school.pickPlan')}</option>
            {(plans.data ?? []).map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('school.reason')}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {/* Tarif cheklovlar uchun; oylik summa formuladan hisoblanadi. */}
        <Notice tone="brand">{t('school.planHint')}</Notice>
      </div>
    </Modal>
  );
}

// --- Qo'lda to'lov belgilash ----------------------------------------
function RecordPaymentModal({ schoolId, suggested, onClose, onDone }: {
  schoolId: string; suggested: number; onClose: () => void; onDone: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [amount, setAmount] = useState(String(suggested));
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [months, setMonths] = useState(1);
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('record_subscription_payment', {
        p_school_id: schoolId,
        p_amount: Number(amount),
        p_paid_on: paidOn,
        p_months: months,
        p_note: note.trim() || undefined,
      });
      if (error) throw error;
      return data as { next_payment_date: string };
    },
    onSuccess: (d) => {
      toast.ok(t('billing.paymentApplied', { date: d.next_payment_date }));
      onDone();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open title={t('school.recordPayment')} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="accent" disabled={!Number(amount) || save.isPending}
                onClick={() => save.mutate()}>
          {t('common.save')}
        </Button>
      </>
    }>
      <div className="space-y-3">
        <Field label={t('billing.amount')} required>
          <Input
            value={amount}
            inputMode="numeric"
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            required
          />
        </Field>
        <Field label={t('billing.paidOn')} required>
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
        </Field>
        <Field label={t('billing.months')} hint={t('billing.monthsHint')}>
          <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[1, 2, 3, 6, 12].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('billing.note')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// =====================================================================
//  DIREKTOR PAROLINI TIKLASH
//
//  Parol FAQAT BIR MARTA ko'rsatiladi va hech qayerda saqlanmaydi —
//  `new-school` oqimidagi bilan bir xil qoida. Shuning uchun oyna
//  yopilishidan oldin tasdiqlash so'raladi.
//
//  Amal Edge Function orqali bajariladi: parolni almashtirish Auth
//  Admin API sini, ya'ni `service_role` kalitini talab qiladi va u
//  brauzerga hech qachon berilmaydi.
// =====================================================================

function ResetPasswordModal({ schoolId, user, onClose }: {
  schoolId: string;
  user: { id: string; full_name: string };
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [password, setPassword] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: async () => await callPlatformOps<{ password: string }>({
      action: 'reset_director_password',
      school_id: schoolId,
      user_id: user.id,
    }),
    onSuccess: (d) => setPassword(d.password),
    onError: (e) => toast.error((e as Error).message),
  });

  async function close() {
    //  Parol ko'rsatilgan bo'lsa, tasodifan yopib yuborish —
    //  direktorni tizimdan chiqarib qo'yish demakdir.
    if (password) {
      const ok = await confirm({
        title: t('reset.confirmCloseTitle'),
        message: t('reset.confirmClose'),
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }

  return (
    <Modal open title={t('school.resetPassword')} onClose={close} footer={
      password ? (
        <Button variant="primary" onClick={close}>{t('common.close')}</Button>
      ) : (
        <>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button variant="danger" disabled={reset.isPending}
                  onClick={() => reset.mutate()}>
            {reset.isPending ? t('reset.working') : t('reset.action')}
          </Button>
        </>
      )
    }>
      {password ? (
        <div className="space-y-3">
          <Notice tone="warn">{t('reset.once')}</Notice>
          <Field label={t('newSchool.password')}>
            <Input value={password} readOnly onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(password)
                .then(() => toast.ok(t('newSchool.copied')))
                .catch(() => toast.error(t('newSchool.copyFailed')));
            }}
          >
            {t('newSchool.copy')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Notice tone="danger">{t('reset.warning', { name: user.full_name })}</Notice>
          <p className="text-[13px] text-[var(--text-muted)]">{t('reset.hint')}</p>
        </div>
      )}
    </Modal>
  );
}
