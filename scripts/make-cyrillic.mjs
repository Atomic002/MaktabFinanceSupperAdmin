#!/usr/bin/env node
// =====================================================================
//  make-cyrillic.mjs — uz.json dan uz-cyrl.json yasaydi.
//
//  O'zbek lotin → kirill transliteratsiyasi. Qo'lda yozishdan ko'ra
//  ishonchli: uz.json ga yangi kalit qo'shilsa, shu skriptni qayta
//  ishga tushirish kifoya (TZ 5.6.5).
//
//  TEGILMAYDI:
//    · {o'rin_egallar}      — kod ularni almashtiradi
//    · email va URL manzillar
//    · lotin brend nomlari  (MaktabFinance, Excel, Telegram...)
//
//  Ishga tushirish: node scripts/make-cyrillic.mjs
// =====================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const I18N = join(ROOT, 'apps', 'super-admin', 'src', 'i18n');

/** Lotin holida qoladigan so'zlar. */
const KEEP = [
  'MaktabFinance', 'Excel', 'Email', 'Telegram', 'PWA',
  'Uztomic', 'CRM', 'SMS', 'ID',
];

// Tartib MUHIM: uzun birikmalar avval almashtiriladi.
const RULES = [
  // Apostrofli harflar (turli apostrof belgilari hisobga olinadi)
  [/o['ʻ‘’`]/g, 'ў'], [/O['ʻ‘’`]/g, 'Ў'],
  [/g['ʻ‘’`]/g, 'ғ'], [/G['ʻ‘’`]/g, 'Ғ'],

  // Digraflar
  [/sh/g, 'ш'], [/Sh/g, 'Ш'], [/SH/g, 'Ш'],
  [/ch/g, 'ч'], [/Ch/g, 'Ч'], [/CH/g, 'Ч'],

  // Yotlashgan unlilar
  [/yo/g, 'ё'], [/Yo/g, 'Ё'],
  [/yu/g, 'ю'], [/Yu/g, 'Ю'],
  [/ya/g, 'я'], [/Ya/g, 'Я'],
  [/ye/g, 'е'], [/Ye/g, 'Е'],

  // Bitta harflar
  [/a/g, 'а'], [/A/g, 'А'],
  [/b/g, 'б'], [/B/g, 'Б'],
  [/d/g, 'д'], [/D/g, 'Д'],
  [/e/g, 'е'], [/E/g, 'Е'],
  [/f/g, 'ф'], [/F/g, 'Ф'],
  [/g/g, 'г'], [/G/g, 'Г'],
  [/h/g, 'ҳ'], [/H/g, 'Ҳ'],
  [/i/g, 'и'], [/I/g, 'И'],
  [/j/g, 'ж'], [/J/g, 'Ж'],
  [/k/g, 'к'], [/K/g, 'К'],
  [/l/g, 'л'], [/L/g, 'Л'],
  [/m/g, 'м'], [/M/g, 'М'],
  [/n/g, 'н'], [/N/g, 'Н'],
  [/o/g, 'о'], [/O/g, 'О'],
  [/p/g, 'п'], [/P/g, 'П'],
  [/q/g, 'қ'], [/Q/g, 'Қ'],
  [/r/g, 'р'], [/R/g, 'Р'],
  [/s/g, 'с'], [/S/g, 'С'],
  [/t/g, 'т'], [/T/g, 'Т'],
  [/u/g, 'у'], [/U/g, 'У'],
  [/v/g, 'в'], [/V/g, 'В'],
  [/x/g, 'х'], [/X/g, 'Х'],
  [/y/g, 'й'], [/Y/g, 'Й'],
  [/z/g, 'з'], [/Z/g, 'З'],

  // Qolgan tutuq belgisi
  [/['ʻ‘’`]/g, 'ъ'],
];

function applyRules(text) {
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}

/**
 * O'zbek kirillida so'z BOSHIDAGI "e" — "э" bilan yoziladi
 * (eksport → экспорт), so'z ichida esa "е" (kelgan → келган).
 */
function fixInitialE(text) {
  return text
    .replace(/(^|[^\p{L}])е/gu, (_, pre) => `${pre}э`)
    .replace(/(^|[^\p{L}])Е/gu, (_, pre) => `${pre}Э`);
}

// Maskalash uchun matnda uchramaydigan belgi.
const M0 = '';
const M1 = '';

function transliterate(text) {
  const saved = [];
  const mask = (m) => {
    saved.push(m);
    return `${M0}${saved.length - 1}${M1}`;
  };

  let masked = text
    // 1) {o'rin egallar}
    .replace(/\{[^}]+\}/g, mask)
    // 2) email va URL
    .replace(/\S+@\S+\.\S+/g, mask)
    .replace(/https?:\/\/\S+/g, mask);

  // 3) brend nomlari
  for (const w of KEEP) {
    masked = masked.replace(new RegExp(w, 'g'), mask);
  }

  let out = fixInitialE(applyRules(masked));

  // Maskani qaytaramiz
  out = out.replace(
    new RegExp(`${M0}(\\d+)${M1}`, 'g'),
    (_, i) => saved[Number(i)],
  );

  return out;
}

const uz = JSON.parse(await readFile(join(I18N, 'uz.json'), 'utf8'));

const out = {};
for (const [key, value] of Object.entries(uz)) {
  out[key] = key === 'app.name' ? value : transliterate(value);
}

await writeFile(
  join(I18N, 'uz-cyrl.json'),
  JSON.stringify(out, null, 2) + '\n',
  'utf8',
);

console.log(`✓ uz-cyrl.json yozildi — ${Object.keys(out).length} ta kalit\n`);
//  Namuna qatorlar — kirillga o'girish haqiqatan ishlaganini ko'z
//  bilan tekshirish uchun. Kalitlar SHU ilovadan olinadi: ilgari
//  bu yerda maktab panelining kalitlari turgan va ular ekranda
//  "undefined" bo'lib chiqardi — go'yo skript ishlamagandek.
console.log('Tekshiruv:');
for (
  const k of Object.keys(out)
    .filter((x) => /^(app|nav|common|sub)./.test(x))
    .slice(0, 6)
) {
  console.log(`  ${k.padEnd(22)} ${out[k]}`);
}
