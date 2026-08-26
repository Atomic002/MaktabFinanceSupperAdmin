// =====================================================================
//  Formatlash — TZ 5.4.20:
//  "Sana, vaqt, son va pul formatlari tanlangan tilga muvofiq
//   shakllantiriladi."
//
//  O'zbek va rus tilida minglik ajratgich — BO'SH JOY (vergul emas).
//  Uzilmaydigan bo'shliq ishlatiladi, shunda raqam satr oxirida
//  bo'linib ketmaydi.
// =====================================================================

export type Lang = 'uz' | 'uz-cyrl' | 'ru';

const LOCALE: Record<Lang, string> = {
  'uz': 'uz-UZ',
  'uz-cyrl': 'uz-UZ',
  'ru': 'ru-RU',
};

const NBSP = '\u00A0';

/** Pul: 1 450 000. Tiyin ko'rsatilmaydi — amalda ishlatilmaydi. */
export function money(value: number | string | null | undefined, lang: Lang = 'uz'): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(LOCALE[lang], {
    maximumFractionDigits: 0,
  }).format(Math.round(n)).replace(/\s/g, NBSP);
}

/** Pul + valyuta belgisi. */
export function moneyFull(value: number | string | null | undefined, lang: Lang = 'uz'): string {
  const suffix = lang === 'ru' ? 'сум' : lang === 'uz-cyrl' ? 'сўм' : "so'm";
  return `${money(value, lang)}${NBSP}${suffix}`;
}

/** Son (kunlar, soatlar). */
export function num(value: number | string | null | undefined, lang: Lang = 'uz', digits = 0): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(LOCALE[lang], {
    maximumFractionDigits: digits,
  }).format(n).replace(/\s/g, NBSP);
}

/** Sana: 22.08.2026 */
export function date(value: string | Date | null | undefined, lang: Lang = 'uz'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

/** Sana va vaqt: 22.08.2026, 14:30 */
export function dateTime(value: string | Date | null | undefined, lang: Lang = 'uz'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

/** Davr sarlavhasi: "Avgust 2026" */
export function periodLabel(period: string, lang: Lang = 'uz'): string {
  const d = new Date(period);
  if (Number.isNaN(d.getTime())) return period;
  const s = new Intl.DateTimeFormat(LOCALE[lang], {
    month: 'long', year: 'numeric',
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Bugungi oyning 1-sanasi — hisob davri kaliti. */
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Davrni oy oldinga/orqaga suradi. */
export function shiftPeriod(period: string, months: number): string {
  const d = new Date(period);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** ISO sana (input[type=date] uchun). */
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${
    String(d.getDate()).padStart(2, '0')}`;
}
