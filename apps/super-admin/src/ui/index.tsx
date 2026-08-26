// =====================================================================
//  UI primitivlari — minimalistik, zich, klaviatura bilan qulay.
//
//  Dizayn tamoyili: buxgalter kuniga yuzlab qatorni ko'radi. Shuning
//  uchun bo'sh joy emas, ZICHLIK va KONTRAST muhim. Jadval qatorlari
//  past, pul ustunlari tabular raqamlar bilan (ustunlar bir-biriga
//  to'g'ri kelsin).
//
//  Barcha matn tashqaridan (i18n orqali) keladi — bu yerda hech qanday
//  qattiq yozilgan matn yo'q (TZ 5.4.19).
// =====================================================================

import {
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { money as fmtMoney } from '@/lib/format';
import { useI18n } from '@/i18n';

// ---------------------------------------------------------------------
//  Tugma
// ---------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

const BTN: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-900 text-white hover:bg-brand-800 active:bg-brand-950 ' +
    'disabled:bg-brand-900/40',
  accent:
    'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 ' +
    'disabled:bg-accent-600/40',
  secondary:
    'border bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--bg-inset)] ' +
    'disabled:opacity-50',
  ghost:
    'text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] ' +
    'disabled:opacity-50',
  danger:
    'bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-40',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm';
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md
        font-medium transition-colors disabled:cursor-not-allowed
        ${pad} ${BTN[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
//  Maydonlar
// ---------------------------------------------------------------------

export function Field({
  label, hint, error, required, children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-[13px] font-medium text-[var(--text-muted)]">
          {label}
          {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
        </span>
      )}
      {children}
      {hint && !error && (
        <span className="mt-1 block text-xs text-[var(--text-faint)]">{hint}</span>
      )}
      {error && (
        <span className="mt-1 block text-xs text-[var(--danger)]">{error}</span>
      )}
    </label>
  );
}

const FIELD_BASE =
  'w-full rounded-md border bg-[var(--bg)] px-2.5 text-sm text-[var(--text)] ' +
  'placeholder:text-[var(--text-faint)] transition-colors ' +
  'focus:border-brand-500 disabled:bg-[var(--bg-inset)] disabled:text-[var(--text-faint)]';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_BASE} h-9 ${className}`} {...rest} />;
}

/**
 * Pul kiritish maydoni — O'ZBEK PUL FORMATIDA.
 *
 * Yozayotganda raqam darhol guruhlanadi: 1500000 → 1 500 000, o'ng
 * tomonda "so'm" turadi. Buxgalter nollarni sanab o'tirmaydi — bir
 * qarashda million bilan yuz mingni ajratadi. Ajratgich UZILMAYDIGAN
 * BO'SHLIQ (TZ 5.4.20), til tanloviga qarab o'zgaradi.
 *
 * TASHQARIGA baribir TOZA RAQAM chiqadi: `onChange` da
 * `e.target.value` — faqat raqamlardan iborat satr. Shu tufayli barcha
 * mavjud `Number(e.target.value)` chaqiruvlari o'zgarishsiz ishlaydi.
 *
 * `type="number"` ATAYLAB ishlatilmagan: brauzer unda o'z formatini
 * majburlaydi va bo'shliqli matnni "noto'g'ri" deb rad etadi.
 */
export function MoneyInput({
  className = '', value, onChange, disabled, ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  const { lang } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  // Formatlashdan keyin kursorni joyiga qaytarish uchun.
  const caret = useRef<number | null>(null);

  const raw = value === null || value === undefined ? '' : String(value);
  const digits = raw.replace(/\D/g, '');
  const display = digits === '' ? '' : fmtMoney(digits, lang);

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const pos = el.selectionStart ?? el.value.length;
    // Kursordan oldingi RAQAMLAR soni — ajratgichlar siljiganda ham
    // shu son o'zgarmaydi, kursorni shunga qarab tiklaymiz.
    const digitsBefore = (el.value.slice(0, pos).match(/\d/g) ?? []).length;

    const next = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const nextDisplay = next === '' ? '' : fmtMoney(next, lang);

    let i = 0;
    let seen = 0;
    while (i < nextDisplay.length && seen < digitsBefore) {
      if (/\d/.test(nextDisplay[i])) seen++;
      i++;
    }
    caret.current = i;

    // Chaqiruvchi tomon faqat `target.value` ni o'qiydi.
    onChange?.({
      ...e,
      target: { ...el, value: next },
    } as unknown as ChangeEvent<HTMLInputElement>);
  }

  const suffix = lang === 'ru' ? 'сум' : lang === 'uz-cyrl' ? 'сўм' : "so'm";

  return (
    <span className="relative block">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        disabled={disabled}
        className={`${FIELD_BASE} num h-9 pr-12 text-right ${className}`}
        {...rest}
      />
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2
          text-[12px] text-[var(--text-faint)]"
        aria-hidden="true"
      >
        {suffix}
      </span>
    </span>
  );
}

export function Select({
  className = '', children, ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_BASE} h-9 pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------
//  Konteynerlar
// ---------------------------------------------------------------------

export function Card({
  title, action, children, className = '', padded = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border bg-[var(--bg)] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------
//  Jadval — zich, gorizontal siljish o'z konteynerida
// ---------------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="table-scroll">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children, align = 'left', className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      className={`sticky top-0 z-10 whitespace-nowrap border-b bg-[var(--bg-subtle)]
        px-3 py-2 text-${align} text-xs font-semibold uppercase tracking-wide
        text-[var(--text-muted)] ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children, align = 'left', className = '', mono = false, colSpan,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  mono?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-[var(--border-soft)] px-3 py-1.5 text-${align}
        ${mono ? 'num' : ''} ${className}`}
    >
      {children}
    </td>
  );
}

export function Tr({
  children, onClick, className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer' : ''}
        hover:bg-[var(--bg-subtle)] ${className}`}
    >
      {children}
    </tr>
  );
}

// ---------------------------------------------------------------------
//  Pul ko'rsatish — musbat/manfiy rangi bilan
// ---------------------------------------------------------------------

export function Money({
  value, colored = false, bold = false,
}: {
  value: number | string | null | undefined;
  /** true — musbat yashil, manfiy qizil. Qarzdorlik ustunlari uchun. */
  colored?: boolean;
  bold?: boolean;
}) {
  const { lang } = useI18n();
  const n = Number(value ?? 0);
  const color = !colored
    ? ''
    : n > 0
    ? 'text-[var(--danger)]'
    : n < 0
    ? 'text-[var(--ok)]'
    : 'text-[var(--text-faint)]';

  return (
    <span className={`num ${color} ${bold ? 'font-semibold' : ''}`}>
      {fmtMoney(n, lang)}
    </span>
  );
}

// ---------------------------------------------------------------------
//  Belgilar
// ---------------------------------------------------------------------

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'brand';

const TONE: Record<Tone, string> = {
  neutral: 'bg-[var(--bg-inset)] text-[var(--text-muted)]',
  ok: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  warn: 'bg-[var(--warn-bg)] text-[var(--warn)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  brand: 'bg-brand-100 text-brand-800',
};

export function Badge({
  children, tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs
        font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------
//  Holatlar
// ---------------------------------------------------------------------

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3"
            strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[var(--text-muted)]">
      <Spinner />
      <span className="text-sm">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function EmptyState({
  title, hint, action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-sm font-medium text-[var(--text)]">
        {title ?? t('common.empty')}
      </p>
      <p className="max-w-sm text-[13px] text-[var(--text-muted)]">
        {hint ?? t('common.emptyHint')}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm font-medium text-[var(--danger)]">{t('common.error')}</p>
      <p className="max-w-lg text-[13px] text-[var(--text-muted)]">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>{t('common.retry')}</Button>
      )}
    </div>
  );
}

/** Ogohlantirish qatori — davr yopilgan, huquq yo'q va h.k. */
export function Notice({
  tone = 'warn', children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-md px-3 py-2 text-[13px] ${TONE[tone]}`}
      role="status"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Modal
// ---------------------------------------------------------------------

export function Modal({
  open, title, onClose, children, footer, wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
        bg-black/40 p-4 pt-[8vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full rounded-lg border bg-[var(--bg)] shadow-xl
          ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-inset)]
              hover:text-[var(--text)]"
            aria-label="close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="p-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
