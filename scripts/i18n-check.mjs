#!/usr/bin/env node
// =====================================================================
//  i18n-check.mjs — tarjima kalitlari joyidami.
//
//  ILGARI IKKITA TESHIK BOR EDI va ikkalasi ham ekranga kod chiqishiga
//  olib kelardi:
//
//    1. Faqat `uz.json` tekshirilardi. Kalit o'zbekchada bo'lib,
//       ruschada bo'lmasa — hech kim sezmasdi. Rus tilidagi
//       foydalanuvchi esa ekranda "payMethod.label" degan kalitni
//       ko'rardi, chunki `t()` topolmasa kalitning o'zini qaytaradi.
//
//    2. Faqat `t('literal')` ko'rinishi qidirilardi. Kod ichida
//       `t(`pay.channel.${p.channel}`)` kabi SHABLON kalitlar ham bor
//       va ular umuman tekshirilmasdi. Bunday kalit uchun ro'yxat
//       bo'sh qolsa, ekranda xom kod chiqadi.
//
//  Endi uchala til ham, shablon kalitlar ham tekshiriladi.
//
//    node scripts/i18n-check.mjs
// =====================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'apps/super-admin/src';

const BUNDLES = {
  'uz.json': JSON.parse(readFileSync(join(SRC, 'i18n/uz.json'), 'utf8')),
  'ru.json': JSON.parse(readFileSync(join(SRC, 'i18n/ru.json'), 'utf8')),
  'uz-cyrl.json': JSON.parse(readFileSync(join(SRC, 'i18n/uz-cyrl.json'), 'utf8')),
};

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(SRC);

const rel = (f) => f.replace(/\\/g, '/').replace(SRC + '/', '');
const problems = [];

// --- 1. Har bir tilda bir xil kalit to'plami --------------------------
const base = Object.keys(BUNDLES['uz.json']);
for (const [name, dict] of Object.entries(BUNDLES)) {
  if (name === 'uz.json') continue;
  const missing = base.filter((k) => !(k in dict));
  const extra = Object.keys(dict).filter((k) => !(k in BUNDLES['uz.json']));
  for (const k of missing) problems.push(`${name} da yo'q: ${k}`);
  for (const k of extra) problems.push(`${name} da ortiqcha: ${k}`);
}

// --- 2. Kodda ishlatilgan literal kalitlar ----------------------------
for (const f of files) {
  if (/i18n[\\/]/.test(f)) continue;
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    for (const [name, dict] of Object.entries(BUNDLES)) {
      if (!(m[1] in dict)) {
        problems.push(`${name}: "${m[1]}" yo'q  ← ${rel(f)}`);
      }
    }
  }
}

// --- 3. Shablon kalitlar: t(`prefix.${...}`) --------------------------
//
//  Aniq kalitni bilib bo'lmaydi — u ish vaqtida hosil bo'ladi.
//  Lekin PREFIKS bo'yicha birorta ham kalit yo'q bo'lsa, bu aniq
//  xato: bunday chaqiruv har doim xom kod qaytaradi.
for (const f of files) {
  if (/i18n[\\/]/.test(f)) continue;
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]*)\$\{/g)) {
    const prefix = m[1];
    if (!prefix) continue;
    const hits = base.filter((k) => k.startsWith(prefix));
    if (hits.length === 0) {
      problems.push(`shablon kalit "${prefix}*" uchun birorta ham tarjima yo'q  ← ${rel(f)}`);
    }
  }
}

// --- Natija ------------------------------------------------------------
if (problems.length === 0) {
  console.log(
    `OK — ${base.length} kalit × ${Object.keys(BUNDLES).length} til, `
    + `${files.length} fayl tekshirildi`,
  );
  process.exit(0);
}

console.log(`YETISHMAYDI (${problems.length}):`);
for (const p of [...new Set(problems)].sort()) console.log(`  ${p}`);
process.exit(1);
