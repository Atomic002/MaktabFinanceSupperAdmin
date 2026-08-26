// =====================================================================
//  Yuqori paneldagi boshqaruv elementlari: til va mavzu.
//
//  Maktab panelidagi `BranchSwitcher` bu yerda YO'Q: platforma
//  admini hech qaysi maktabga tegishli emas va filial konteksti
//  umuman mavjud emas.
// =====================================================================

import { useEffect, useState } from 'react';
import { LANGS, useI18n, useT } from '@/i18n';
import { Select } from '@/ui';

// ---------------------------------------------------------------------
//  Til (TZ 5.6.1 — foydalanuvchi darajasida)
// ---------------------------------------------------------------------

export function LangSwitcher() {
  const { lang, setLang } = useI18n();
  const t = useT();

  return (
    <Select
      value={lang}
      onChange={(e) => setLang(e.target.value as typeof lang)}
      aria-label={t('common.language')}
      className="w-auto min-w-[7.5rem]"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </Select>
  );
}

// ---------------------------------------------------------------------
//  Yorug' / qorong'i mavzu
// ---------------------------------------------------------------------

type Theme = 'light' | 'dark' | 'system';
const THEME_KEY = 'admin-theme';

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* maxfiy oyna */ }
  return 'system';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch { /* maxfiy oyna */ }
  }, [theme]);

  const next: Record<Theme, Theme> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  };

  const icon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️';

  return (
    <button
      onClick={() => setTheme(next[theme])}
      title={t('common.theme')}
      aria-label={t('common.theme')}
      className="flex h-9 w-9 items-center justify-center rounded-md border
        bg-[var(--bg)] text-sm hover:bg-[var(--bg-inset)]"
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
