// =====================================================================
//  Platforma admini konteksti.
//
//  Maktab panelidagi `AuthProvider` dan JIDDIY FARQ QILADI:
//    · `app_users` YO'Q — platforma admini hech qaysi maktabga
//      tegishli emas
//    · filial konteksti YO'Q
//    · `role_permissions` YO'Q — super adminda rol darajalari yo'q,
//      u yo bor, yo yo'q
//
//  Yagona savol: `platform_admins` da faol yozuv bormi. Javobni
//  BAZA beradi — `platform_admins_select` siyosati
//  `app.is_platform_admin()` ga bog'langan, ya'ni admin bo'lmagan
//  odam bu so'rovdan bo'sh natija oladi. Brauzerdagi tekshiruv
//  bezak; haqiqiy himoya RLS da.
// =====================================================================

import {
  createContext, type ReactNode, useCallback, useContext,
  useEffect, useMemo, useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface PlatformAdmin {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface AuthValue {
  session: Session | null;
  admin: PlatformAdmin | null;
  loading: boolean;
  /** 'notAdmin' — kirdi, lekin platforma admini emas. */
  error: string | null;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAdmin = useCallback(async (uid: string) => {
    const { data, error: err } = await supabase
      .from('platform_admins')
      .select('id, full_name, email, phone, is_active, created_at')
      .eq('id', uid)
      .maybeSingle();

    if (err) {
      setAdmin(null);
      setError(err.message);
      return;
    }

    // Yozuv yo'q yoki o'chirilgan — ikkalasi ham "kirish yo'q".
    // Farqini foydalanuvchiga aytmaymiz: bu ma'lumot begonaga
    // "bu tizimda platforma adminlari bor" degan ishorani beradi.
    if (!data || !data.is_active) {
      setAdmin(null);
      setError('notAdmin');
      return;
    }

    setAdmin(data as PlatformAdmin);
    setError(null);
  }, []);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user) await loadAdmin(data.session.user.id);
      if (alive) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!alive) return;
      setSession(s);
      if (s?.user) {
        await loadAdmin(s.user.id);
      } else {
        setAdmin(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadAdmin]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAdmin(null);
    setSession(null);
  }, []);

  const reload = useCallback(async () => {
    if (session?.user) await loadAdmin(session.user.id);
  }, [session, loadAdmin]);

  const value = useMemo<AuthValue>(
    () => ({ session, admin, loading, error, signOut, reload }),
    [session, admin, loading, error, signOut, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth faqat AuthProvider ichida ishlaydi');
  return v;
}
