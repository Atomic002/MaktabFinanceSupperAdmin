// =====================================================================
//  Kirish oynasi.
//
//  Maktab panelidan farqi: TELEFON BILAN KIRISH YO'Q. Platforma
//  admini uchun har doim haqiqiy pochta talab qilinadi — parolni
//  tiklash faqat pochta orqali ishlaydi, sintetik `@maktab.local`
//  manzilga esa xat bormaydi.
// =====================================================================

import { type FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { Button, Field, Input, Notice } from '@/ui';

export default function LoginPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    // Parol chetidagi bo'sh joy OLIB TASHLANADI. Odam ataylab parolni
    // bo'sh joy bilan boshlamaydi yoki tugatmaydi — bu deyarli har doim
    // mobil klaviaturaning ishi yoki nusxa ko'chirishdagi ortiqcha belgi.
    // Tizim yaratadigan parollarda ham bo'sh joy yo'q.
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });

    if (err) setError(err.message);
    setBusy(false);
  }

  async function onReset() {
    if (!email.includes('@')) {
      setError(t('auth.emailNeeded'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/parol-tiklash` },
    );
    if (err) setError(err.message);
    else setInfo(t('auth.resetSent'));
    setBusy(false);
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--bg-subtle)] p-4">
      <div className="w-full max-w-sm rounded-lg border bg-[var(--bg)] p-6 shadow-sm">
        <header className="mb-5 text-center">
          <h1 className="text-lg font-semibold text-[var(--text)]">
            {t('app.name')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {t('app.tagline')}
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field label={t('auth.email')} required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              required
            />
          </Field>

          <Field label={t('auth.password')} required>
            <span className="relative block">
              <Input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                // MOBIL KLAVIATURA JILOVI — busiz telefonda kirish buziladi.
                //
                // `type="password"` da telefon o'zi to'g'ri ishlaydi, lekin
                // "ko'rsatish" bosilganda maydon `text` ga aylanadi va
                // klaviatura odatiy matn kabi muomala qiladi: birinchi
                // harfni KATTA qiladi va so'z tugaganda oxiriga BO'SH JOY
                // qo'shadi. Ikkalasi ham "login yoki parol xato" beradi,
                // kompyuterda esa ishlaydi — shuning uchun sabab uzoq
                // vaqt ko'rinmay qoladi.
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="pr-10"
                required
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShow((v) => !v)}
                aria-label={t('auth.showPassword')}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5
                  text-[var(--text-faint)] hover:text-[var(--text)]"
              >
                <span aria-hidden="true">{show ? '🙈' : '👁'}</span>
              </button>
            </span>
          </Field>

          {error && (
            <div className="space-y-2">
              <Notice tone="danger">{error}</Notice>
              {/* Qaysi maydon xato ekani AYTILMAYDI — bu hujumchiga
                  "bunday login bor" degan ma'lumot berardi. Lekin eng
                  ko'p uchraydigan sababni eslatib qo'yish hech narsani
                  oshkor qilmaydi va yordam beradi. */}
              <p className="text-[12px] text-[var(--text-muted)]">
                {t('auth.invalidHint')}
              </p>
            </div>
          )}
          {info && <Notice tone="ok">{info}</Notice>}

          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </Button>

          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="w-full text-center text-xs text-[var(--text-muted)] hover:underline"
          >
            {t('auth.forgot')}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[var(--text-faint)]">
          Uztomic Solutions
        </p>
      </div>
    </div>
  );
}
