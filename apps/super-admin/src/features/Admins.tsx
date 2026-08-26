// =====================================================================
//  Platforma operatorlari.
//
//  FAQAT KO'RISH. Bu ekranda "qo'shish" tugmasi ATAYLAB yo'q.
//
//  SABAB: `platform_admins` jadvalida INSERT siyosati umuman
//  yaratilmagan (TZ 5.4.11) — ya'ni ilova orqali yozib bo'lmaydi.
//  Yangi operator faqat `service_role` kaliti bo'lgan odam
//  tomonidan, buyruq satridan qo'shiladi:
//
//    node scripts/new-platform-admin.mjs "Ism Familiya" pochta@uztomic.uz
//
//  Bu qasddan noqulay: super admin BARCHA maktablarni ko'radi.
//  Uni qo'shish paneldagi ikki bosishga aylanmasligi kerak.
// =====================================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useI18n, useT } from '@/i18n';
import { date, dateTime } from '@/lib/format';
import {
  Badge, Card, ErrorState, Loading, Notice, PageHeader,
  Table, Td, Th, Tr,
} from '@/ui';

export default function Admins() {
  const t = useT();
  const { lang } = useI18n();
  const { admin: me } = useAuth();

  const admins = useQuery({
    queryKey: ['platform-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('id, full_name, email, phone, is_active, created_at')
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Kim qachon nima qilgani — operatorlar bo'yicha jamlanma.
  const activity = useQuery({
    queryKey: ['admin-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_log')
        .select('admin_id, at')
        .not('admin_id', 'is', null)
        .order('at', { ascending: false })
        .limit(1000);
      if (error) throw error;

      const map = new Map<string, { count: number; last: string }>();
      for (const r of data ?? []) {
        const id = r.admin_id as string;
        const prev = map.get(id);
        if (prev) prev.count += 1;
        else map.set(id, { count: 1, last: r.at as string });
      }
      return map;
    },
  });

  if (admins.isLoading) return <Loading />;
  if (admins.error) {
    return <ErrorState message={(admins.error as Error).message}
                       onRetry={() => admins.refetch()} />;
  }

  const list = admins.data ?? [];

  return (
    <>
      <PageHeader
        title={t('admins.title')}
        subtitle={t('common.showing', { count: list.length })}
      />

      <Notice tone="brand">{t('admins.addHint')}</Notice>

      <Card className="mt-3" padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>{t('admins.name')}</Th>
              <Th>{t('admins.email')}</Th>
              <Th>{t('schools.phone')}</Th>
              <Th>{t('schools.status')}</Th>
              <Th align="right">{t('admins.actions')}</Th>
              <Th>{t('admins.lastAction')}</Th>
              <Th>{t('admins.since')}</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const act = activity.data?.get(a.id);
              return (
                <Tr key={a.id}>
                  <Td>
                    <span className="font-medium">{a.full_name}</span>
                    {a.id === me?.id && (
                      <Badge tone="brand">{t('admins.you')}</Badge>
                    )}
                  </Td>
                  <Td className="text-[var(--text-muted)]">{a.email ?? '—'}</Td>
                  <Td mono>{a.phone ?? '—'}</Td>
                  <Td>
                    <Badge tone={a.is_active ? 'ok' : 'neutral'}>
                      {t(a.is_active ? 'admins.active' : 'admins.inactive')}
                    </Badge>
                  </Td>
                  <Td align="right" mono>{act?.count ?? 0}</Td>
                  <Td mono className="text-[var(--text-muted)]">
                    {act ? dateTime(act.last, lang) : '—'}
                  </Td>
                  <Td mono className="text-[var(--text-muted)]">
                    {date(a.created_at, lang)}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <p className="mt-3 text-[11px] text-[var(--text-faint)]">
        {t('admins.countHint')}
      </p>
    </>
  );
}
