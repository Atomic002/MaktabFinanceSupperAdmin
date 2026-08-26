// =====================================================================
//  Marshrutlar va kirish darvozalari.
//
//  DARVOZA TARTIBI MUHIM:
//    1. yuklanmoqda
//    2. /parol-tiklash — admin tekshiruvidan OLDIN. Tiklash havolasi
//       vaqtinchalik sessiya ochadi; agar tekshiruv oldinda tursa,
//       odam "siz admin emassiz" ekraniga tushib qoladi va parolni
//       hech qachon o'zgartira olmaydi.
//    3. sessiya yo'q → kirish
//    4. sessiya bor, lekin platforma admini emas → rad javobi
//    5. qolgan hollarda — panel
// =====================================================================

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import LoginPage from '@/auth/LoginPage';
import ResetPasswordPage from '@/auth/ResetPasswordPage';
import AppShell from '@/layout/AppShell';
import { useT } from '@/i18n';
import { Button, Loading } from '@/ui';
import { supabase } from '@/lib/supabase';

const Overview   = lazy(() => import('@/features/Overview'));
const Schools    = lazy(() => import('@/features/Schools'));
const SchoolCard = lazy(() => import('@/features/SchoolCard'));
const NewSchool  = lazy(() => import('@/features/NewSchool'));
const Billing    = lazy(() => import('@/features/Billing'));
const Support    = lazy(() => import('@/features/Support'));
const Journal    = lazy(() => import('@/features/Journal'));
const Settings   = lazy(() => import('@/features/Settings'));
const Admins     = lazy(() => import('@/features/Admins'));

/**
 * Kirdi, lekin platforma admini emas.
 *
 * Sabab ATAYLAB aytilmaydi ("yozuvingiz yo'q" / "o'chirilgan").
 * Bu ma'lumot begonaga tizim haqida ortiqcha narsa aytadi.
 */
function NotAdmin() {
  const t = useT();
  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--bg-subtle)] p-4">
      <div className="w-full max-w-md rounded-lg border bg-[var(--bg)] p-6 text-center">
        <h1 className="text-base font-semibold text-[var(--text)]">
          {t('auth.notAdmin')}
        </h1>
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          {t('auth.notAdminHint')}
        </p>
        <Button
          className="mt-4"
          onClick={() => supabase.auth.signOut()}
        >
          {t('auth.logout')}
        </Button>
      </div>
    </div>
  );
}

export default function App() {
  const { session, admin, loading, error } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <div className="flex min-h-full items-center justify-center"><Loading /></div>;
  }

  // Parolni tiklash har qanday holatda ochiq bo'lishi kerak.
  if (pathname === '/parol-tiklash') return <ResetPasswordPage />;

  if (!session) return <LoginPage />;
  if (error === 'notAdmin' || !admin) return <NotAdmin />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Suspense fallback={<Loading />}><Overview /></Suspense>} />
        <Route path="maktablar" element={<Suspense fallback={<Loading />}><Schools /></Suspense>} />
        <Route path="maktablar/yangi" element={<Suspense fallback={<Loading />}><NewSchool /></Suspense>} />
        <Route path="maktablar/:id" element={<Suspense fallback={<Loading />}><SchoolCard /></Suspense>} />
        <Route path="tolovlar" element={<Suspense fallback={<Loading />}><Billing /></Suspense>} />
        <Route path="murojaatlar" element={<Suspense fallback={<Loading />}><Support /></Suspense>} />
        <Route path="jurnal" element={<Suspense fallback={<Loading />}><Journal /></Suspense>} />
        <Route path="sozlamalar" element={<Suspense fallback={<Loading />}><Settings /></Suspense>} />
        <Route path="adminlar" element={<Suspense fallback={<Loading />}><Admins /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
