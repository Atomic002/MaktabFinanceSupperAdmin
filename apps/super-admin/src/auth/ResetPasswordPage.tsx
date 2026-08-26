// =====================================================================
//  Parolni tiklash.
//
//  Pochtadagi havola vaqtinchalik sessiya ochadi va shu sahifaga
//  olib keladi. Shu sessiya ichida foydalanuvchi yangi parol
//  qo'yishi mumkin.
//
//  MUHIM: bu sahifa `App.tsx` da platforma admini tekshiruvidan
//  OLDIN turadi. Aks holda tiklash havolasi bilan kirgan odam
//  "siz admin emassiz" ekraniga tushib qolardi va parolni hech
//  qachon o'zgartira olmasdi.
// =====================================================================

import { type FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { Button, Field, Input, Notice } from '@/ui';

export default function ResetPasswordPage() {
  const t = useT();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== repeat) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (err) setError(err.message);
    else setDone(true);
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--bg-subtle)] p-4">
      <div className="w-full max-w-sm rounded-lg border bg-[var(--bg)] p-6 shadow-sm">
        <h1 className="mb-4 text-center text-lg font-semibold">
          {t('auth.newPassword')}
        </h1>

        {done ? (
          <div className="space-y-3">
            <Notice tone="ok">{t('auth.passwordChanged')}</Notice>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => { window.location.href = '/'; }}
            >
              {t('auth.toPanel')}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')} required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                required
              />
            </Field>

            <Field label={t('auth.repeatPassword')} required>
              <Input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>

            {error && <Notice tone="danger">{error}</Notice>}

            <Button type="submit" variant="primary" disabled={busy} className="w-full">
              {busy ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
