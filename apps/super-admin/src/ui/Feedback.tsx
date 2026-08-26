// =====================================================================
//  Toast bildirishnomalari va tasdiqlash oynasi.
//
//  Nega kerak: hozirgacha amal bajarilganda foydalanuvchi hech qanday
//  javob ko'rmasdi — tugma bosildi, ro'yxat jimgina yangilandi.
//  Xato bo'lsa esa sahifa ichidagi `Notice` da chiqardi, uni topish
//  kerak edi.
//
//  Tasdiqlash oynasi — qaytarib bo'lmaydigan amallar uchun (yillik
//  ko'chirish, bekor qilish). Brauzerning `confirm()` i emas: u
//  mavzuga bo'ysunmaydi va matnni tarjima qilib bo'lmaydi.
// =====================================================================

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useT } from '@/i18n';
import { Button, Modal, Notice } from './index';

// =====================================================================
//  TOAST
// =====================================================================

type ToastTone = 'ok' | 'danger' | 'warn' | 'neutral';

interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ToastValue {
  /** Muvaffaqiyat xabari — 3 soniyada o'zi yo'qoladi. */
  ok: (text: string) => void;
  /** Xato — uzoqroq turadi, chunki o'qish kerak. */
  error: (text: string) => void;
  warn: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const TONE_CLASS: Record<ToastTone, string> = {
  ok: 'border-[var(--ok)] bg-[var(--ok-bg)] text-[var(--ok)]',
  danger: 'border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]',
  warn: 'border-[var(--warn)] bg-[var(--warn-bg)] text-[var(--warn)]',
  neutral: 'bg-[var(--bg)] text-[var(--text)]',
};

const ICON: Record<ToastTone, string> = {
  ok: '✓', danger: '✕', warn: '!', neutral: 'i',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((tone: ToastTone, text: string, ms: number) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, tone, text }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  }, []);

  const value = useMemo<ToastValue>(() => ({
    ok: (text) => push('ok', text, 3000),
    // Xato xabari uzoqroq turadi — foydalanuvchi o'qib ulgursin.
    error: (text) => push('danger', text, 8000),
    warn: (text) => push('warn', text, 5000),
    info: (text) => push('neutral', text, 4000),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="no-print pointer-events-none fixed bottom-4 right-4 z-[100]
          flex w-full max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg
              border px-3 py-2.5 text-[13px] shadow-lg ${TONE_CLASS[t.tone]}`}
          >
            <span className="mt-px flex h-4 w-4 shrink-0 items-center
              justify-center rounded-full bg-current/15 text-[10px] font-bold">
              {ICON[t.tone]}
            </span>
            <span className="flex-1 whitespace-pre-line">{t.text}</span>
            <button
              onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}
              className="shrink-0 opacity-50 hover:opacity-100"
              aria-label="close"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast faqat ToastProvider ichida ishlaydi');
  return ctx;
}

// =====================================================================
//  TASDIQLASH OYNASI
// =====================================================================

interface ConfirmOptions {
  title?: string;
  /** Asosiy savol. */
  message: string;
  /** Qo'shimcha ogohlantirish — qizil qatorda chiqadi. */
  warning?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type Resolver = (ok: boolean) => void;

const ConfirmContext = createContext<
  ((o: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<Resolver | null>(null);

  const ask = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Modal
        open={!!opts}
        title={opts?.title ?? t('ux.confirmTitle')}
        onClose={() => close(false)}
        footer={
          <>
            <Button onClick={() => close(false)}>{t('common.cancel')}</Button>
            <Button
              variant={opts?.danger ? 'danger' : 'primary'}
              onClick={() => close(true)}
            >
              {opts?.confirmLabel ?? t('common.confirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">{opts?.message}</p>
          {opts?.warning && <Notice tone="danger">{opts.warning}</Notice>}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/**
 * Tasdiqlash so'raydi.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ message: '...', danger: true })) { ... }
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm faqat ConfirmProvider ichida ishlaydi');
  return ctx;
}

// =====================================================================
//  JADVALNI SARALASH
//
//  Ustun sarlavhasini bosib saralash. Hozirgacha barcha ro'yxat
//  serverdagi tartibda edi — buxgalter "eng katta qarzdorlik" ni
//  topolmasdi.
// =====================================================================

export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
  /** Ustun sarlavhasiga beriladigan onClick. */
  toggle: (key: K) => void;
  /** Ro'yxatni saralaydi. */
  apply: <T>(rows: T[], get: (row: T, key: K) => unknown) => T[];
  indicator: (key: K) => string;
}

export function useSort<K extends string>(
  initialKey: K | null = null,
  initialDir: SortDir = 'asc',
): SortState<K> {
  const [key, setKey] = useState<K | null>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);

  const toggle = useCallback((k: K) => {
    setKey((prev) => {
      if (prev === k) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return k;
      }
      setDir('asc');
      return k;
    });
  }, []);

  const apply = useCallback(<T,>(rows: T[], get: (row: T, k: K) => unknown) => {
    if (!key) return rows;
    const sign = dir === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      const av = get(a, key);
      const bv = get(b, key);

      // Bo'sh qiymatlar har doim oxirida — saralash yo'nalishidan qat'i nazar.
      if (av === null || av === undefined || av === '') return 1;
      if (bv === null || bv === undefined || bv === '') return -1;

      const an = typeof av === 'number' ? av : Number(av);
      const bn = typeof bv === 'number' ? bv : Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * sign;

      return String(av).localeCompare(String(bv), 'uz') * sign;
    });
  }, [key, dir]);

  const indicator = useCallback(
    (k: K) => (key !== k ? '' : dir === 'asc' ? ' ↑' : ' ↓'),
    [key, dir],
  );

  return { key, dir, toggle, apply, indicator };
}

// =====================================================================
//  FILTR CHIPLARI
// =====================================================================

export function FilterChips<T extends string>({
  value, options, onChange, allLabel,
}: {
  value: T | '';
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (v: T | '') => void;
  allLabel?: string;
}) {
  const t = useT();

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
      active
        ? 'border-[var(--sel-border)] bg-[var(--sel-bg)] text-[var(--sel-text)]'
        : 'text-[var(--text-muted)] hover:bg-[var(--bg-inset)]'
    }`;

  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange('')} className={chip(value === '')}>
        {allLabel ?? t('ux.filterAll')}
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={chip(value === o.value)}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="ml-1 opacity-60">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// =====================================================================
//  KLAVIATURA YORLIG'I
// =====================================================================

/** Ctrl+K / Cmd+K bosilganda chaqiriladi. */
export function useHotkey(
  key: string,
  handler: () => void,
  opts: { ctrl?: boolean } = { ctrl: true },
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const wantCtrl = opts.ctrl !== false;
      const hasCtrl = e.ctrlKey || e.metaKey;
      if (wantCtrl && !hasCtrl) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      e.preventDefault();
      handler();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [key, handler, opts.ctrl]);
}
