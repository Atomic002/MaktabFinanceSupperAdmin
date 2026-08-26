// =====================================================================
//  Harakatsizlik qo'riqchisi.
//
//  MUAMMO: eng real xavf hujum emas — kanselyariyadagi umumiy
//  kompyuter ochiq qolishi. Buxgalter tushlikka chiqadi, panel
//  ochiq turadi; xohlagan odam kelib to'lov yozadi yoki qarzdorlik
//  ro'yxatini ko'radi.
//
//  Supabase'ning o'z sessiya cheklovi (`sessions_inactivity_timeout`)
//  faqat Pro tarifda. Shuning uchun shu chegara ILOVA DARAJASIDA
//  qo'yiladi: harakat bo'lmasa sessiya tugaydi.
//
//  Nega localStorage: bir nechta oyna ochiq bo'lishi mumkin. Har biri
//  o'z taymerini yuritsa, biri ishlayotganda ikkinchisi chiqarib
//  yuborardi. Oxirgi harakat vaqti umumiy joyda saqlanadi.
//
//  Nega `signOut` yetarli: u refresh tokenni bekor qiladi, ya'ni
//  brauzerda qolgan token bilan qaytadan kirib bo'lmaydi.
// =====================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useT } from '@/i18n';
import { Button, Modal } from '@/ui';

/** Harakatsizlik chegarasi. */
const IDLE_MS = 45 * 60 * 1000;

/** Chiqarishdan necha vaqt oldin ogohlantiriladi. */
const WARN_MS = 2 * 60 * 1000;

/** Tekshirish qadami. Tez-tez tekshirish shart emas. */
const TICK_MS = 10 * 1000;

const KEY = 'admin-last-activity';

/** Barcha oyna uchun umumiy: oxirgi harakat vaqti. */
function readLast(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : Date.now();
  } catch {
    return Date.now();
  }
}

function writeLast(t: number) {
  try { localStorage.setItem(KEY, String(t)); } catch { /* private rejim */ }
}

export function IdleGuard() {
  const t = useT();
  const { session, signOut } = useAuth();
  const [warnLeft, setWarnLeft] = useState<number | null>(null);
  const signingOut = useRef(false);

  const touch = useCallback(() => {
    writeLast(Date.now());
    setWarnLeft(null);
  }, []);

  // --- Harakatni kuzatish ------------------------------------------
  useEffect(() => {
    if (!session) return;

    // `passive` — sahifa siljishini sekinlashtirmasin.
    const opts = { passive: true } as AddEventListenerOptions;
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

    for (const e of events) globalThis.addEventListener(e, touch, opts);

    // Boshqa ilovadan qaytganda ham harakat hisoblanadi — lekin
    // faqat chegaradan oshmagan bo'lsa. Aks holda tunab qolgan
    // brauzerni ochish sessiyani tiriltirib yuborardi.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - readLast() < IDLE_MS) touch();
    };
    document.addEventListener('visibilitychange', onVisible);

    touch();

    return () => {
      for (const e of events) globalThis.removeEventListener(e, touch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, touch]);

  // --- Chegarani tekshirish ----------------------------------------
  useEffect(() => {
    if (!session) return;

    const id = setInterval(() => {
      const idle = Date.now() - readLast();

      if (idle >= IDLE_MS) {
        if (signingOut.current) return;
        signingOut.current = true;
        setWarnLeft(null);
        void signOut();
        return;
      }

      const left = IDLE_MS - idle;
      setWarnLeft(left <= WARN_MS ? left : null);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [session, signOut]);

  if (!session || warnLeft === null) return null;

  const seconds = Math.max(0, Math.ceil(warnLeft / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return (
    <Modal
      open
      title={t('idle.title')}
      onClose={touch}
      footer={
        <>
          <Button onClick={() => { setWarnLeft(null); void signOut(); }}>
            {t('auth.logout')}
          </Button>
          <Button variant="primary" onClick={touch}>
            {t('idle.stay')}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-sm">{t('idle.message')}</p>
        <p className="num text-2xl font-semibold text-[var(--danger)]">
          {minutes}:{String(rest).padStart(2, '0')}
        </p>
        <p className="text-[13px] text-[var(--text-muted)]">{t('idle.why')}</p>
      </div>
    </Modal>
  );
}
