// =====================================================================
//  Jadvalni Excel ga chiqarish (TZ 4.12.5) va CSV o'qish (TZ 4.7.2.1).
//
//  CHIQARISH — .xlsx. Ilgari CSV edi va u ISHONCHSIZ:
//
//    · ajratgichni Excel FOYDALANUVCHI KOMPYUTERIDAGI til sozlamasi
//      bo'yicha tanlaydi. Mos kelmasa butun jadval bitta ustunga
//      tushib qoladi;
//    · o'nlik belgi ham shunday. Mos kelmasa summalar son emas, MATN
//      bo'lib qoladi va ular bo'yicha yig'indi chiqarib bo'lmaydi.
//
//  Ya'ni bitta fayl bir kompyuterda to'g'ri, boshqasida buzuq
//  ochilardi — buni yuboruvchi tomondan boshqarib bo'lmasdi.
//  `lib/xlsx.ts` ga qarang: xlsx da son son, matn matn bo'lib
//  yoziladi va til sozlamasi hech narsaga ta'sir qilmaydi.
//
//  O'QISH — CSV bo'lib qoladi: bank vypiskalari aynan shu formatda
//  keladi va uni biz tanlamaymiz.
//
//  TZ 4.12.7 — sarlavhalar tanlangan tilda shakllantiriladi,
//  shuning uchun ustun nomlari chaqiruvchi tomonidan beriladi.
// =====================================================================

import { downloadXlsx, type SheetRow } from './xlsx';

export interface Column<T> {
  /** Ustun sarlavhasi — allaqachon tarjima qilingan matn. */
  header: string;
  /** Qator qiymati. */
  value: (row: T) => string | number | null | undefined;
  /** Raqam ustunimi — Excel uni son sifatida o'qishi uchun. */
  numeric?: boolean;
}

/**
 * Jadvalni Excel fayliga aylantirib brauzerdan yuklab beradi.
 *
 * @param filename  kengaytmasiz nom — sana o'zi qo'shiladi
 */
export function exportTable<T>(
  filename: string,
  columns: Array<Column<T>>,
  rows: T[],
  /** Ixtiyoriy sarlavha satrlari (davr, filial va h.k.). */
  meta: string[] = [],
): void {
  const sheet: SheetRow[] = [];

  for (const m of meta) sheet.push({ cells: [m], bold: true });
  if (meta.length) sheet.push({ cells: [] });

  sheet.push({ cells: columns.map((c) => c.header), bold: true });

  for (const row of rows) {
    sheet.push({
      cells: columns.map((c) => {
        const raw = c.value(row);
        if (raw === null || raw === undefined || raw === '') return null;

        if (c.numeric) {
          const n = Number(raw);
          //  Son bo'lmasa matn bo'lib ketaveradi: "—" yoki bo'sh
          //  katakni nolga aylantirish hisobotni buzadi.
          return Number.isFinite(n) ? n : String(raw);
        }
        return String(raw);
      }),
    });
  }

  //  Ustun kengligi: sarlavha va eng uzun qiymatga qarab.
  const widths = columns.map((c, i) => {
    const longest = sheet.reduce(
      (m, r) => Math.max(m, String(r.cells[i] ?? '').length), c.header.length);
    return Math.min(42, Math.max(10, longest + 2));
  });

  downloadXlsx(filename, sheet, widths);
}

// =====================================================================
//  CSV o'qish — bank vypiskasi uchun (TZ 4.7.2.1)
// =====================================================================

/** Ajratgichni fayl mazmunidan topadi: ; yoki , yoki tab. */
function detectDelimiter(sample: string): string {
  const counts = [';', ',', '\t'].map((d) => ({
    d,
    n: (sample.match(new RegExp(`\\${d}`, 'g')) ?? []).length,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ';';
}

/** Bitta CSV satrini katakchalarga ajratadi (qo'shtirnoqni hisobga olib). */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/**
 * CSV matnini sarlavha va qatorlarga ajratadi.
 * Bo'sh satrlar tashlab yuboriladi.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return { headers: [], rows: [] };

  const delim = detectDelimiter(lines[0] + '\n' + (lines[1] ?? ''));
  const headers = splitLine(lines[0], delim);
  const rows = lines.slice(1).map((l) => splitLine(l, delim));

  return { headers, rows };
}

/**
 * Turli formatdagi sanani ISO ga keltiradi.
 * Bank vypiskalarida ko'p uchraydigan shakllar qo'llab-quvvatlanadi:
 * 22.08.2026 · 2026-08-22 · 22/08/2026 · 22-08-2026
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // kun.oy.yil (nuqta, slash yoki chiziqcha)
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Summani songa aylantiradi.
 * "1 450 000,00" · "1,450,000.00" · "1450000" — hammasi ishlaydi.
 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\s ]/g, '').replace(/[^\d.,-]/g, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Vergul o'nlik belgisi: 1.450.000,00
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Nuqta o'nlik belgisi: 1,450,000.00
    s = s.replace(/,/g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
