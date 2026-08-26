// =====================================================================
//  Maktab bilan yozishma.
//
//  Chap tomonda mavzular, o'ngda suhbat. Ikkala tomon ham bir xil
//  yozishmani ko'radi — maktab direktori o'z panelida shu xabarlarni
//  o'qiydi.
//
//  TIZIM XABARLARI boshqacha ko'rsatiladi: "chek tasdiqlandi",
//  "maktab bloklandi" kabi xabarlarni odam yozmagan. Ularni oddiy
//  javob bilan aralashtirib yuborish nizoga olib keladi.
//
//  MUHIM: bloklangan maktab ham bu yerga yoza oladi (migratsiya 41).
//  Ya'ni "bloklandim, gaplashib ham bo'lmaydi" degan holat yo'q.
// =====================================================================

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { dateTime } from '@/lib/format';
import {
  Badge, Button, Card, EmptyState, Field, Input, Loading, Modal,
  PageHeader, Select, Table, Td, Tr,
} from '@/ui';
import { useToast } from '@/ui/Feedback';

type Thread = {
  id: string;
  school_id: string;
  subject: string;
  status: string;
  priority: string;
  last_message_at: string;
  platform_read_at: string | null;
  opened_by_platform: boolean;
  schools: { name: string; status: string } | null;
};

export default function Support() {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [active, setActive] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const threads = useQuery({
    queryKey: ['support-threads', showClosed],
    queryFn: async () => {
      let q = supabase
        .from('support_threads')
        .select('*, schools(name, status)')
        .order('last_message_at', { ascending: false })
        .limit(200);
      if (!showClosed) q = q.neq('status', 'closed');
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Thread[];
    },
    refetchInterval: 60_000,
  });

  const messages = useQuery({
    queryKey: ['support-messages', active],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_messages')
        .select('id, from_platform, is_system, body, file_path, created_at, sender_id')
        .eq('thread_id', active!)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  // Mavzu ochilganda "o'qildi" belgilanadi — menyudagi raqam
  // haqiqatni ko'rsatib tursin.
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('mark_support_read', { p_thread_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-threads'] });
      qc.invalidateQueries({ queryKey: ['nav-counts'] });
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('post_support_message', {
        p_thread_id: active!,
        p_body: draft.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['support-messages', active] });
      qc.invalidateQueries({ queryKey: ['support-threads'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: 'open' | 'closed') => {
      const { error } = await supabase.rpc('set_support_thread_status', {
        p_thread_id: active!, p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-threads'] });
      toast.ok(t('ux.saved'));
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    if (active) markRead.mutate(active);
    // markRead barqaror emas — faqat `active` o'zgarishiga qaraymiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.data]);

  const list = threads.data ?? [];
  const current = list.find((x) => x.id === active) ?? null;

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (draft.trim()) post.mutate();
  }

  return (
    <>
      <PageHeader
        title={t('support.title')}
        subtitle={t('common.showing', { count: list.length })}
        actions={
          <>
            <Button onClick={() => setShowClosed((v) => !v)}>
              {t(showClosed ? 'support.hideClosed' : 'support.showClosed')}
            </Button>
            <Button variant="primary" onClick={() => setComposing(true)}>
              {t('support.new')}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[22rem_1fr]">
        {/* --- Mavzular ------------------------------------------- */}
        <Card padded={false} className="max-h-[70vh] overflow-y-auto">
          {threads.isLoading ? <Loading /> : list.length === 0 ? (
            <EmptyState title={t('support.empty')} hint={t('support.emptyHint')} />
          ) : (
            <Table>
              <tbody>
                {list.map((th) => {
                  const unread = !th.platform_read_at
                    || new Date(th.last_message_at) > new Date(th.platform_read_at);
                  return (
                    <Tr
                      key={th.id}
                      onClick={() => setActive(th.id)}
                      className={active === th.id ? 'bg-[var(--sel-bg)]' : ''}
                    >
                      <Td>
                        <div className="flex items-center gap-1.5">
                          {unread && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]" />
                          )}
                          <span className={`truncate text-[13px] ${unread ? 'font-semibold' : ''}`}>
                            {th.subject}
                          </span>
                          {th.priority === 'high' && <Badge tone="danger">!</Badge>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5
                          text-[11px] text-[var(--text-muted)]">
                          <span className="truncate">{th.schools?.name}</span>
                          <span>·</span>
                          <span className="num">{dateTime(th.last_message_at, lang)}</span>
                          {th.status === 'closed' && <Badge>{t('support.closed')}</Badge>}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        {/* --- Suhbat --------------------------------------------- */}
        <Card
          padded={false}
          title={current ? current.subject : t('support.pick')}
          action={current && (
            <div className="flex items-center gap-2">
              <Link
                to={`/maktablar/${current.school_id}`}
                className="text-[13px] hover:underline"
              >
                {current.schools?.name}
              </Link>
              <Button
                size="sm"
                onClick={() => setStatus.mutate(current.status === 'closed' ? 'open' : 'closed')}
              >
                {t(current.status === 'closed' ? 'support.reopen' : 'support.close')}
              </Button>
            </div>
          )}
        >
          {!current ? (
            <EmptyState title={t('support.pick')} hint={t('support.pickHint')} />
          ) : (
            <div className="flex max-h-[60vh] flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {messages.isLoading ? <Loading /> : (messages.data ?? []).map((m) => {
                  const mine = m.from_platform as boolean;
                  const system = m.is_system as boolean;
                  return (
                    <div
                      key={String(m.id)}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-[13px] ${
                        system
                          ? 'w-full bg-[var(--bg-inset)] text-center text-[var(--text-muted)]'
                          : mine
                            ? 'bg-brand-900 text-white'
                            : 'border bg-[var(--bg)]'
                      }`}>
                        <p className="whitespace-pre-wrap">{m.body as string}</p>
                        <p className={`mt-1 text-[11px] ${
                          mine && !system ? 'text-brand-300' : 'text-[var(--text-faint)]'
                        }`}>
                          {system && `${t('support.system')} · `}
                          {dateTime(m.created_at as string, lang)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>

              <form onSubmit={onSend} className="flex gap-2 border-t p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('support.placeholder')}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!draft.trim() || post.isPending}
                >
                  {t('support.send')}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>

      {composing && (
        <NewThreadModal
          onClose={() => setComposing(false)}
          onDone={(id) => {
            qc.invalidateQueries({ queryKey: ['support-threads'] });
            setActive(id);
          }}
        />
      )}
    </>
  );
}

// --- Yangi mavzu ochish ----------------------------------------------
function NewThreadModal({ onClose, onDone }: {
  onClose: () => void; onDone: (id: string) => void;
}) {
  const t = useT();
  const toast = useToast();
  const [schoolId, setSchoolId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');

  const schools = useQuery({
    queryKey: ['schools-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools').select('id, name')
        .is('deleted_at', null).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('open_support_thread', {
        p_subject: subject.trim(),
        p_body: body.trim(),
        p_school_id: schoolId,
        p_priority: priority,
      });
      if (error) throw error;
      return data as { thread_id: string };
    },
    onSuccess: (d) => { onDone(d.thread_id); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const valid = schoolId && subject.trim().length >= 3 && body.trim().length >= 1;

  return (
    <Modal open title={t('support.new')} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={!valid || create.isPending}
                onClick={() => create.mutate()}>
          {t('support.send')}
        </Button>
      </>
    }>
      <div className="space-y-3">
        <Field label={t('schools.name')} required>
          <Select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} required>
            <option value="">{t('support.pickSchool')}</option>
            {(schools.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('support.subject')} required>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </Field>
        <Field label={t('support.priority')}>
          <Select value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}>
            <option value="low">{t('priority.low')}</option>
            <option value="normal">{t('priority.normal')}</option>
            <option value="high">{t('priority.high')}</option>
          </Select>
        </Field>
        <Field label={t('support.message')} required>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full rounded-md border bg-[var(--bg)] px-2.5 py-2 text-sm
              text-[var(--text)] focus:border-brand-500"
            required
          />
        </Field>
      </div>
    </Modal>
  );
}
