// =====================================================================
//  i18n — TZ 5.4.19:
//  "Interfeysda matn qatorlari kodga yozilmaydi. Barcha matnlar i18n
//   mexanizmi orqali kalit bo'yicha chaqiriladi. Bu qoida BIRINCHI
//   KOMPONENTDAN amal qiladi."
//
//  Yengil mexanizm — tashqi kutubxonasiz. Sabab: bizga faqat kalit →
//  matn va o'rin egallar kerak; ko'plik shakllari va murakkab
//  formatlash uchun `Intl` yetarli (lib/format.ts).
//
//  TZ 5.6.5 — yangi til qo'shish uchun kodga o'zgartirish kerak emas:
//  yangi JSON fayl qo'shiladi va LANGS ro'yxatiga yoziladi.
//
//  Dev rejimida topilmagan kalit konsolga ogohlantirish beradi —
//  shunda tarjimasiz matn ishga tushirishgacha yetib bormaydi (TZ 8.11).
// =====================================================================

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Lang } from '@/lib/format';
import uz from './uz.json';
import uzCyrl from './uz-cyrl.json';
import ru from './ru.json';

type Dict = Record<string, string>;

const BUNDLES: Record<Lang, Dict> = {
  'uz': uz as Dict,
  'uz-cyrl': uzCyrl as Dict,
  'ru': ru as Dict,
};

export const LANGS: Array<{ code: Lang; label: string }> = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'uz-cyrl', label: 'Ўзбекча' },
  { code: 'ru', label: 'Русский' },
];

const STORAGE_KEY = 'admin-lang';

/** Kalitni matnga aylantiradi va {o'rin} egallarni to'ldiradi. */
function lookup(lang: Lang, key: string, params?: Record<string, unknown>): string {
  let text = BUNDLES[lang]?.[key];

  if (text === undefined) {
    // Standart tilga qaytamiz — matn yo'qolib ketmasin.
    text = BUNDLES.uz?.[key];
    if (import.meta.env.DEV && text === undefined) {
      console.warn(`[i18n] tarjima yo'q: "${key}" (${lang})`);
    }
  }

  if (text === undefined) return key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in BUNDLES) return saved as Lang;
  } catch {
    // Maxfiy oynada localStorage yopiq bo'lishi mumkin — muhim emas.
  }
  return 'uz';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch { /* muhim emas */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'uz';
  }, [lang]);

  const value = useMemo<I18nValue>(() => ({
    lang,
    setLang,
    t: (key, params) => lookup(lang, key, params),
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n faqat I18nProvider ichida ishlaydi');
  return ctx;
}

/** Qisqa yozuv: const t = useT(); t('nav.students') */
export function useT() {
  return useI18n().t;
}
