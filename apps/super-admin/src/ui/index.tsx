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
  type ComponentPropsWithRef,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { money as fmtMoney } from '@/lib/format';
import { useI18n } from '@/i18n';

// ---------------------------------------------------------------------
//  Tugma
// ---------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

const BTN: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)] ' +
    'disabled:opacity-40',
  accent:
    'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 ' +
    'disabled:bg-accent-600/40',
  secondary:
    'border bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--bg-subtle)] ' +
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
  const pad = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm';
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-[10px]
        whitespace-nowrap font-medium transition-[background-color,color,transform] active:scale-[0.98]
        disabled:cursor-not-allowed disabled:active:scale-100
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

//  Kenglik chaqiruvchidan kelsa (`w-auto`, `max-w-xs` ...) `w-full`
//  qo'yilmaydi: ikkala sinf bir vaqtda turganda Tailwind CSS tartibi
//  bo'yicha `w-full` yutardi va masalan kirish sahifasidagi til
//  tanlagich butun ekran kengligiga cho'zilib ketardi.
function fieldBase(className: string): string {
  return /(^|\s)w-/.test(className) ? FIELD_BASE : `w-full ${FIELD_BASE}`;
}

const FIELD_BASE =
  'rounded-[10px] border bg-[var(--bg)] px-3 text-sm text-[var(--text)] ' +
  'placeholder:text-[var(--text-faint)] transition-[border-color,box-shadow] outline-none ' +
  'focus:border-[var(--text-muted)] focus:ring-4 focus:ring-[var(--bg-inset)] ' +
  'disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-faint)]';

//  `ref` ham qabul qilinadi: kursor holatini boshqarish kerak
//  bo'lgan maydonlar (masalan telefon) shu orqali ishlaydi.
//  React 19 da bu oddiy prop — `forwardRef` kerak emas.
export function Input({ className = '', ...rest }: ComponentPropsWithRef<'input'>) {
  return <input className={`${fieldBase(className)} h-10 ${className}`} {...rest} />;
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
        className={`${fieldBase(className)} num h-10 pr-12 text-right ${className}`}
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
    <select className={`${fieldBase(className)} h-10 pr-8 ${className}`} {...rest}>
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
      className={`rounded-2xl border bg-[var(--bg)] ${className}`}
    >
      {(title || action) && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b
          border-[var(--border-soft)] px-5 py-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
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
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)] md:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------
//  Jadval — zich, gorizontal siljish o'z konteynerida
// ---------------------------------------------------------------------

/**
 *  Telefonda jadval kartochkalarga aylanadi.
 *
 *  Ilgari 43 ta jadval telefonda gorizontal suriladigan keng jadval
 *  bo'lib qolardi: ustunlar mayda, summa ko'rinmasdi, qatorni bosish
 *  qiyin edi. Endi har bir katakka sarlavha nomi `data-label` bilan
 *  yoziladi va CSS (`.rtable`) tor ekranda har qatorni "yorliq — qiymat"
 *  ko'rinishidagi kartochka qilib chizadi. Katta ekranda hech narsa
 *  o'zgarmaydi.
 *
 *  Yorliqlar DOM dan olinadi — 43 ta jadvalning har birini qayta
 *  yozish shart emas, yangi ustun qo'shilsa ham o'zi ishlaydi.
 */
export function Table({ children, stack = true }: { children: ReactNode; stack?: boolean }) {
  const ref = useRef<HTMLTableElement | null>(null);

  useEffect(() => {
    const table = ref.current;
    if (!table || !stack) return;
    const label = () => {
      const heads = Array.from(table.querySelectorAll('thead th')).map(
        (th) => (th.textContent ?? '').trim(),
      );
      table.querySelectorAll('tbody tr').forEach((tr) => {
        let col = 0;
        Array.from(tr.children).forEach((cell) => {
          const td = cell as HTMLTableCellElement;
          const text = heads[col] ?? '';
          if (td.getAttribute('data-label') !== text) td.setAttribute('data-label', text);
          col += td.colSpan || 1;
        });
      });
    };
    label();
    const obs = new MutationObserver(label);
    obs.observe(table, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [stack]);

  return (
    <div className="table-scroll">
      <table ref={ref} className={`w-full border-collapse text-sm ${stack ? 'rtable' : ''}`}>
        {children}
      </table>
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
      className={`sticky top-0 z-10 whitespace-nowrap border-b bg-[var(--bg)]
        px-4 py-2.5 text-${align} text-[12px] font-medium
        text-[var(--text-faint)] ${className}`}
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
      className={`border-b border-[var(--border-soft)] px-4 py-2.5 text-${align}
        ${mono ? 'num' : ''} ${className}`}
    >
      {children}
    </td>
  );
}

export function Tr({
  children, onClick, to, className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  /** Qatorning istalgan joyini bossa — shu sahifa ochiladi. Ichidagi
   *  tugma, havola va maydonlar o'z ishini qiladi (qatorga o'tmaydi). */
  to?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const go = to
    ? (e: MouseEvent<HTMLTableRowElement>) => {
        if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
        if (e.ctrlKey || e.metaKey) window.open(to, '_blank');
        else navigate(to);
      }
    : onClick;
  return (
    <tr
      onClick={go}
      className={`${go ? 'cursor-pointer' : ''}
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
  brand: 'bg-[var(--bg-inset)] text-[var(--text)]',
};

export function Badge({
  children, tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5
        text-[11.5px] font-medium ${TONE[tone]}`}
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
      className={`rounded-xl px-4 py-3 text-[13px] leading-relaxed ${TONE[tone]}`}
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
        bg-black/40 p-4 pt-[8vh] backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full rounded-2xl border bg-[var(--bg)] shadow-[var(--shadow-pop)]
          ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
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
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Ko'rsatkich kartasi — bosh sahifa va hisobotlarda bir xil ko'rinish.
//  Bitta asosiy raqam, bitta qisqa izoh. Ortiqcha matn yo'q.
// ---------------------------------------------------------------------

export function Stat({
  label, value, hint, tone = 'neutral', delta, invertDelta, children,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'ok' | 'danger' | 'warn';
  /** Oldingi davrga nisbatan foiz. null — taqqoslash yo'q. */
  delta?: number | null;
  /** Xarajat uchun: o'sish YOMON, rang teskari. */
  invertDelta?: boolean;
  children?: ReactNode;
}) {
  const color = tone === 'ok' ? 'text-[var(--ok)]'
    : tone === 'danger' ? 'text-[var(--danger)]'
    : tone === 'warn' ? 'text-[var(--warn)]'
    : 'text-[var(--text)]';
  const good = delta === null || delta === undefined
    ? null : invertDelta ? delta <= 0 : delta >= 0;
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border bg-[var(--bg)] p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] text-[var(--text-muted)]">{label}</span>
        {delta !== null && delta !== undefined && (
          <span className={`num shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium
            ${good ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--danger-bg)] text-[var(--danger)]'}`}>
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className={`num mt-2 truncate text-[22px] font-semibold leading-tight tracking-tight
        md:text-[24px] ${color}`}>
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-[12px] text-[var(--text-faint)]">{hint}</div>}
      {children}
    </div>
  );
}

/** Ingichka foiz chizig'i. */
export function Progress({ value, tone }: {
  value: number;
  tone?: 'ok' | 'warn' | 'danger' | 'neutral';
}) {
  const v = Math.min(100, Math.max(0, value));
  const tn = tone ?? (v >= 80 ? 'ok' : v >= 50 ? 'warn' : 'danger');
  const bar = tn === 'ok' ? 'bg-[var(--ok)]' : tn === 'warn' ? 'bg-[var(--warn)]'
    : tn === 'danger' ? 'bg-[var(--danger)]' : 'bg-[var(--text)]';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
      <div className={`h-full rounded-full ${bar} transition-[width] duration-500`}
           style={{ width: `${v}%` }} />
    </div>
  );
}

/** Segmentli tanlagich — filtr chiplari o'rniga, bitta qatorda. */
export function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-[10px] bg-[var(--bg-inset)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3
            text-[13px] transition-colors ${value === o.value
              ? 'bg-[var(--bg)] font-medium text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
