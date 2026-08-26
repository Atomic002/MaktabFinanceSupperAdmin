// =====================================================================
//  Platforma jurnali (TZ E6).
//
//  `platform_log` va `impersonation_log` BIRLASHGAN vaqt chizig'i.
//  Ikkalasi alohida jadval, lekin operator uchun bu bitta savol:
//  "shu maktabda kim nima qildi".
//
//  O'CHIRIB BO'LMAYDI. Jadvallarda DELETE siyosati yo'q va
//  bo'lmasligi kerak (TZ 2.5 §5) — bu yerda ham o'chirish tugmasi
//  ATAYLAB yo'q.
// =====================================================================

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n, useT } from '@/i18n';
import { detailText } from '@/lib/detail';
import { dateTime, isoDate } from '@/lib/format';
import {
  Badge, Button, Card, EmptyState, Input, Loading, PageHeader,
  Select, Table, Td, Th, Tr,
} from '@/ui';

type Entry = {
  key: string;
  at: string;
  kind: 'platform' | 'impersonation';
  action: string;
  school_id: string | null;
  school_name: string | null;
  admin_name: string | null;
  detail: unknown;
};

export default function Journal() {
  const t = useT();
  const { lang } = useI18n();

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate());
  const [schoolId, setSchoolId] = useState('');
  const [kind, setKind] = useState<'all' | 'platform' | 'impersonation'>('all');

  const schools = useQuery({
    queryKey: ['schools-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools').select('id, name').is('deleted_at', null).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const admins = useQuery({
    queryKey: ['admins-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_admins').select('id, full_name');
      if (error) throw error;
      return new Map((data ?? []).map((a) => [a.id, a.full_name] as const));
    },
  });

  const platform = useQuery({
    queryKey: ['journal-platform', from, to, schoolId],
    queryFn: async () => {
      let q = supabase
        .from('platform_log')
        .select('id, admin_id, action, entity, entity_id, school_id, before, after, at')
        .gte('at', `${from}T00:00:00`)
        .lte('at', `${to}T23:59:59`)
        .order('at', { ascending: false })
        .limit(300);
      if (schoolId) q = q.eq('school_id', schoolId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const impersonation = useQuery({
    queryKey: ['journal-imp', from, to, schoolId],
    queryFn: async () => {
      let q = supabase
        .from('impersonation_log')
        .select('id, admin_id, school_id, mode, action, detail, at')
        .gte('at', `${from}T00:00:00`)
        .lte('at', `${to}T23:59:59`)
        .order('at', { ascending: false })
        .limit(300);
      if (schoolId) q = q.eq('school_id', schoolId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const schoolNames = useMemo(
    () => new Map((schools.data ?? []).map((s) => [s.id, s.name] as const)),
    [schools.data],
  );

  // Ikkala jurnal bitta ro'yxatga qo'shiladi va vaqt bo'yicha
  // saralanadi. Bu operator uchun tabiiy tartib: nima ketma-ket
  // sodir bo'lgani ko'rinsin.
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];

    if (kind !== 'impersonation') {
      for (const r of platform.data ?? []) {
        out.push({
          key: `p${r.id}`,
          at: r.at as string,
          kind: 'platform',
          action: r.action as string,
          school_id: r.school_id as string | null,
          school_name: r.school_id ? schoolNames.get(r.school_id as string) ?? null : null,
          admin_name: r.admin_id
            ? admins.data?.get(r.admin_id as string) ?? null
            : null,
          detail: r.after ?? r.before,
        });
      }
    }

    if (kind !== 'platform') {
      for (const r of impersonation.data ?? []) {
        out.push({
          key: `i${r.id}`,
          at: r.at as string,
          kind: 'impersonation',
          action: r.action as string,
          school_id: r.school_id as string,
          school_name: schoolNames.get(r.school_id as string) ?? null,
          admin_name: admins.data?.get(r.admin_id as string) ?? null,
          detail: { mode: r.mode, ...(r.detail as object ?? {}) },
        });
      }
    }

    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [platform.data, impersonation.data, kind, schoolNames, admins.data]);

  const loading = platform.isLoading || impersonation.isLoading;

  return (
    <>
      <PageHeader
        title={t('journal.title')}
        subtitle={t('common.showing', { count: entries.length })}
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[13px] text-[var(--text-muted)]">
            {t('journal.from')}
          </span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] text-[var(--text-muted)]">
            {t('journal.to')}
          </span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Select
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className="w-auto min-w-[14rem]"
        >
          <option value="">{t('journal.allSchools')}</option>
          {(schools.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="w-auto"
        >
          <option value="all">{t('journal.allKinds')}</option>
          <option value="platform">{t('journal.kindPlatform')}</option>
          <option value="impersonation">{t('journal.kindImpersonation')}</option>
        </Select>
        <Button onClick={() => { platform.refetch(); impersonation.refetch(); }}>
          {t('common.refresh')}
        </Button>
      </div>

      {loading ? <Loading /> : entries.length === 0 ? (
        <EmptyState title={t('common.empty')} hint={t('journal.emptyHint')} />
      ) : (
        <Card padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>{t('journal.at')}</Th>
                <Th>{t('journal.kind')}</Th>
                <Th>{t('journal.action')}</Th>
                <Th>{t('schools.name')}</Th>
                <Th>{t('journal.admin')}</Th>
                <Th>{t('journal.detail')}</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Tr key={e.key}>
                  <Td mono className="whitespace-nowrap">{dateTime(e.at, lang)}</Td>
                  <Td>
                    <Badge tone={e.kind === 'impersonation' ? 'warn' : 'neutral'}>
                      {t(`journal.kind${e.kind === 'platform' ? 'Platform' : 'Impersonation'}`)}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{t(`action.${e.action}`)}</Td>
                  <Td>
                    {e.school_id ? (
                      <Link to={`/maktablar/${e.school_id}`} className="hover:underline">
                        {e.school_name ?? e.school_id.slice(0, 8)}
                      </Link>
                    ) : <span className="text-[var(--text-faint)]">—</span>}
                  </Td>
                  <Td className="text-[var(--text-muted)]">{e.admin_name ?? '—'}</Td>
                  {/*  Ilgari bu yerda xom JSON turardi va ustun tor
                       bo'lgani uchun matn yarmida kesilardi — ya'ni
                       "Tafsilot" ustuni joy egallab, savolga javob
                       bermasdi. */}
                  <Td className="max-w-lg text-[11px] text-[var(--text-muted)]">
                    {detailText(t, e.detail) ?? '—'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <p className="mt-3 text-[11px] text-[var(--text-faint)]">
        {t('journal.immutable')}
      </p>
    </>
  );
}
