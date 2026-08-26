// =====================================================================
//  Supabase mijozi.
//
//  DIQQAT — `storageKey` MAKTAB PANELIDAN FARQ QILADI.
//
//  Maktab paneli `maktab-moliya-auth` kalitidan foydalanadi. Agar
//  ikkalasi bir xil bo'lsa va ikkala ilova bir domenda ochilsa,
//  ular BIR-BIRINING SESSIYASINI o'chirib yuboradi: super admin
//  texnik yordam sessiyasini ochganda o'z hisobidan chiqib ketardi.
//
//  Ishlab chiqishda ikkalasi ham `localhost` da (5173 va 5174) —
//  port boshqacha bo'lgani uchun origin ham boshqacha, lekin bunga
//  tayanib qolmaymiz.
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'VITE_SUPABASE_URL va VITE_SUPABASE_PUBLISHABLE_KEY sozlanmagan. '
    + '.env.local faylini tekshiring.',
  );
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'admin-platform-auth',
  },
});

/** Maktab paneli manzili — texnik yordam sessiyasi shu yerga o'tkazadi. */
export const SCHOOL_PANEL_URL =
  import.meta.env.VITE_SCHOOL_PANEL_URL || 'https://maktab.uztomic.uz';

/**
 * Edge Function chaqiruvi.
 *
 * `supabase.functions.invoke` xato matnini yutib yuboradi — javob
 * tanasini o'qimaydi va faqat "non-2xx status" deydi. Bu yerda esa
 * xatolar aynan foydali: "bu login band", "sabab qisqa", "hook
 * yoqilmagan". Shuning uchun chaqiruv qo'lda yoziladi.
 */
export async function callPlatformOps<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessiya topilmadi');

  const res = await fetch(`${url}/functions/v1/platform-ops`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Server javobi JSON emas (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const message = (parsed as { error?: string })?.error;
    throw new Error(message ?? `HTTP ${res.status}`);
  }
  return parsed as T;
}
