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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75"
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
  { to: '/sozlamalar',  labelKey: 'nav.settings', icon: I.gear },
  { to: '/adminlar',    labelKey: 'nav.admins',   icon: I.users },
];

export default function AppShell() {
  const t = useT();
  const { admin, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  // Menyudagi raqamlar. `platform_overview` allaqachon ikkalasini ham
  // qaytaradi — alohida so'rov yozish shart emas.
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
    `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
      isActive
        ? 'bg-brand-800 font-medium text-white'
        : 'text-brand-200 hover:bg-brand-800/60 hover:text-white'
    }`;

  const nav = (
    <nav className="space-y-0.5">
      {NAV.map((item) => {
        const n = item.badge ? counts.data?.[item.badge] ?? 0 : 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <Icon d={item.icon} />
            <span className="flex-1">{t(item.labelKey)}</span>
            {n > 0 && (
              <span className="rounded-full bg-[var(--danger)] px-1.5 py-0.5
                text-[11px] font-semibold leading-none text-white">
                {n}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-full flex-col">
      {/* Platforma paneli ekanini unutib qo'ymaslik uchun doimiy chiziq.
          Bu ilovada har bir amal BARCHA maktablarga ta'sir qiladi. */}
      <div className="bg-brand-950 px-4 py-1 text-center text-[11px]
        font-medium uppercase tracking-wider text-brand-300">
        {t('app.platformBanner')}
      </div>

      <div className="flex flex-1">
        <aside className="hidden w-56 flex-col bg-brand-900 p-3 md:flex">
          <div className="mb-4 px-1.5">
            <p className="text-sm font-semibold text-white">{t('app.name')}</p>
            <p className="text-[11px] text-brand-300">{t('app.platform')}</p>
          </div>
          {nav}
          <div className="mt-auto border-t border-brand-800 pt-3">
            <p className="px-1.5 text-[13px] font-medium text-white">
              {admin?.full_name}
            </p>
            <p className="px-1.5 text-[11px] text-brand-300">{admin?.email}</p>
            <button
              onClick={signOut}
              className="mt-2 w-full rounded-md px-2.5 py-1.5 text-left text-[13px]
                text-brand-200 hover:bg-brand-800 hover:text-white"
            >
              {t('auth.logout')}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b
            bg-[var(--bg)] px-3 py-2 md:px-5">
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md border p-1.5 md:hidden"
              aria-label={t('nav.menu')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="flex-1" />
            <LangSwitcher />
            <ThemeToggle />
          </header>

          {open && (
            <div className="border-b bg-brand-900 p-3 md:hidden">{nav}</div>
          )}

          <main className="flex-1 px-3 py-4 md:px-5 md:py-5">
            <Outlet />
          </main>
        </div>
      </div>

      <IdleGuard />
    </div>
  );
}
