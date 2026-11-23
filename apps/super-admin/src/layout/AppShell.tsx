// =====================================================================
//  Panel qobig'i: yon menyu, sarlavha, kutayotgan ishlar belgisi.
//
//  Maktab panelidan farqi — MENYUDA HUQUQ FILTRI YO'Q. Platforma
//  adminida rol darajalari yo'q: u yo hamma narsani ko'radi, yo
//  umuman kira olmaydi. Shuning uchun `can()` chaqiruvi ham yo'q.
//
//  QIZIL BELGI (`badge`): "nechta chek kutmoqda" va "nechta o'qilmagan
//  xabar" — ijrochining kunlik ishi shu ikki raqamdan boshlanadi.
//  Ular menyuda turishi kerak, sahifani ochib ko'rish emas.
// =====================================================================

import { type ReactNode, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { LangSwitcher, ThemeToggle } from '@/layout/Controls';
import { IdleGuard } from '@/auth/IdleGuard';

// --- Ikonkalar. Kutubxona qo'shilmaydi — beshta yo'l yetarli. ------
const I = {
  home:    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  school:  <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-5h6v5" />,
  money:   <path d="M12 3v18M7 7h7a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8" />,
  chat:    <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z" />,
  journal: <path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4zM8 8h8M8 12h8M8 16h5" />,
  gear:    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 4.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 9V9a2 2 0 1 1 0 4h-.1z" />,
  users:   <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
};

function Icon({ d }: { d: ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

type Item = { to: string; labelKey: string; icon: ReactNode; badge?: 'payments' | 'messages' };

const NAV: Item[] = [
  { to: '/',            labelKey: 'nav.overview', icon: I.home },
  { to: '/maktablar',   labelKey: 'nav.schools',  icon: I.school },
  { to: '/tolovlar',    labelKey: 'nav.billing',  icon: I.money,   badge: 'payments' },
  { to: '/murojaatlar', labelKey: 'nav.support',  icon: I.chat,    badge: 'messages' },
  { to: '/jurnal',      labelKey: 'nav.journal',  icon: I.journal },
  { to: '/adminlar',    labelKey: 'nav.admins',   icon: I.users },
  { to: '/sozlamalar',  labelKey: 'nav.settings', icon: I.gear },
];

const LOGO = `${import.meta.env.BASE_URL}logo-mark.svg`;

function initials(name?: string | null) {
  return (name ?? '?').split(/s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]!.toUpperCase()).join('');
}

/** Uztomic Edu — platforma boshqaruvi. Maktab paneli bilan bir xil
 *  dizayn: oq yon menyu, bitta urg'u rang, ortiqcha bezaksiz. */
export default function AppShell() {
  const t = useT();
  const { admin, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  // Menyudagi raqamlar. `platform_overview` ikkalasini ham qaytaradi.
  const counts = useQuery({
    queryKey: ['nav-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('platform_overview');
      if (error) throw error;
      const row = data?.[0];
      return {
        payments: row?.pending_payments ?? 0,
        messages: row?.unread_threads ?? 0,
      };
    },
    refetchInterval: 60_000,
  });

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-[10px] px-3 py-[7px] text-[13.5px] transition-colors ${
      isActive
        ? 'bg-[var(--sel-bg)] font-medium text-[var(--text)]'
        : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]'
    }`;

  const nav = (
    <nav className="space-y-px">
      {NAV.map((item) => {
        const n = item.badge ? counts.data?.[item.badge] ?? 0 : 0;
        return (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
                   className={linkClass} onClick={() => setOpen(false)}>
            <Icon d={item.icon} />
            <span className="flex-1 truncate">{t(item.labelKey)}</span>
            {n > 0 && (
              <span className="num min-w-5 rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-center
                text-[11px] font-semibold leading-none text-white">
                {n}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <img src={LOGO} alt="" className="h-8 w-8 rounded-[9px]" width={32} height={32} />
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold leading-tight tracking-tight">
          Uztomic <span className="text-accent-600 dark:text-accent-400">Edu</span>
        </div>
        <div className="truncate text-[12px] leading-tight text-[var(--text-faint)]">
          {t('app.platform')}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r bg-[var(--bg)] md:flex">
        <div className="px-5 pb-5 pt-5">{brand}</div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">{nav}</div>
        <div className="flex items-center gap-2.5 border-t px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
            bg-[var(--bg-inset)] text-[12px] font-semibold">
            {initials(admin?.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{admin?.full_name}</div>
            <div className="truncate text-[11.5px] text-[var(--text-faint)]">{admin?.email}</div>
          </div>
          <button onClick={signOut} title={t('auth.logout')} aria-label={t('auth.logout')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-faint)]
                    hover:bg-[var(--bg-inset)] hover:text-[var(--text)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
            </svg>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-[var(--bg)] px-3 md:px-6">
          <button onClick={() => setOpen((v) => !v)} aria-label={t('nav.menu')}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border md:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <div className="md:hidden">{brand}</div>
          <div className="flex-1" />
          <LangSwitcher />
          <ThemeToggle />
        </header>

        {open && (
          <div className="border-b bg-[var(--bg)] p-3 md:hidden">{nav}</div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--bg-subtle)]">
          <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-7">
            <Outlet />
          </div>
        </main>
      </div>

      <IdleGuard />
    </div>
  );
}
