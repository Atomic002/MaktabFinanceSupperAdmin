// =====================================================================
//  HAQIQIY EXCEL FAYLI (.xlsx) — kutubxonasiz.
//
//  NEGA CSV DAN VOZ KECHILDI. CSV oddiy matn va Excel uni O'QIYOTGAN
//  KOMPYUTERNING til sozlamasi bo'yicha talqin qiladi:
//
//    · ajratgich — ru/uz sozlamasida nuqtali vergul, en sozlamasida
//      vergul. Noto'g'ri bo'lsa BUTUN JADVAL BITTA USTUNGA tushadi;
//    · o'nlik belgi — vergul yoki nuqta. Noto'g'ri bo'lsa summalar
//      son emas, MATN bo'lib qoladi va ular bo'yicha yig'indi
//      chiqarib bo'lmaydi.
//
//  Ya'ni bitta fayl bir kompyuterda to'g'ri, boshqasida buzuq
//  ochiladi — va buni fayl yaratayotgan tomondan boshqarib bo'lmaydi.
//
//  XLSX da bunday muammo yo'q: son son bo'lib, matn matn bo'lib
//  YOZILADI, kodlash esa har doim UTF-8. Til sozlamasi hech narsaga
//  ta'sir qilmaydi.
//
//  Tashqi kutubxona qo'shilmadi: xlsx — bu ichida bir nechta XML
//  bo'lgan oddiy ZIP. Siqishsiz (store) ZIP yozish uchun CRC32 va
//  bir nechta sarlavha yetarli — hammasi shu faylda.
// =====================================================================

// ---------------------------------------------------------------------
//  ZIP (siqishsiz)
// ---------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc: number;
  offset: number;
}

/** Siqishsiz ZIP yig'adi. Excel uchun siqish shart emas. */
function zip(files: Array<{ name: string; text: string }>): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  const push = (b: Uint8Array) => { chunks.push(b); offset += b.length; };

  //  Sana/vaqt maydoni: barcha yozuvlarga bir xil qiymat qo'yiladi.
  //  Fayl ichidagi vaqt hech qayerda ishlatilmaydi, lekin nol bo'lsa
  //  ba'zi arxivatorlar ogohlantirish beradi.
  const dosTime = 0x6000;   // 12:00
  const dosDate = 0x5CE1;   // 2026-07-01

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);

    const head = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(head.buffer);
    dv.setUint32(0, 0x04034B50, true);   // local file header
    dv.setUint16(4, 20, true);           // version needed
    dv.setUint16(6, 0x0800, true);       // UTF-8 nomlar
    dv.setUint16(8, 0, true);            // siqish yo'q
    dv.setUint16(10, dosTime, true);
    dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    head.set(nameBytes, 30);

    entries.push({ name: f.name, data, crc, offset });
    push(head);
    push(data);
  }

  const cdStart = offset;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const rec = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(rec.buffer);
    dv.setUint32(0, 0x02014B50, true);   // central directory
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, dosTime, true);
    dv.setUint16(14, dosDate, true);
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.data.length, true);
    dv.setUint32(24, e.data.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, e.offset, true);
    rec.set(nameBytes, 46);
    push(rec);
  }

  const end = new Uint8Array(22);
  const dv = new DataView(end.buffer);
  dv.setUint32(0, 0x06054B50, true);     // end of central directory
  dv.setUint16(8, entries.length, true);
  dv.setUint16(10, entries.length, true);
  dv.setUint32(12, offset - cdStart, true);
  dv.setUint32(16, cdStart, true);
  push(end);

  return new Blob(chunks as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ---------------------------------------------------------------------
//  XLSX
// ---------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    //  Excel boshqaruv belgilarini qabul qilmaydi va butun faylni
    //  "buzilgan" deb e'lon qiladi. Ular olib tashlanadi.
    // deno-lint-ignore no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/** 0 → A, 25 → Z, 26 → AA */
function colName(i: number): string {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export type SheetCell = string | number | null | undefined;

export interface SheetRow {
  cells: SheetCell[];
  /** Qalin shrift — sarlavha va jami qatorlari uchun. */
  bold?: boolean;
}

/**
 *  Bitta varaqli xlsx yasaydi va brauzerdan yuklab beradi.
 *
 *  @param widths  ustun kengliklari (belgilarda). Berilmasa taxminiy.
 */
export function downloadXlsx(
  filename: string,
  rows: SheetRow[],
  widths?: number[],
): void {
  const body = rows.map((row, r) => {
    const cells = row.cells.map((v, c) => {
      const ref = `${colName(c)}${r + 1}`;
      const style = row.bold ? ' s="1"' : '';

      if (v === null || v === undefined || v === '') {
        return `<c r="${ref}"${style}/>`;
      }
      //  Son bo'lsa AYNAN son bo'lib yoziladi — Excel uni yig'indi
      //  va saralashda to'g'ri ishlatadi.
      if (typeof v === 'number' && Number.isFinite(v)) {
        return `<c r="${ref}"${style}><v>${v}</v></c>`;
      }
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">`
        + `${esc(String(v))}</t></is></c>`;
    }).join('');

    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');

  const colCount = rows.reduce((m, r) => Math.max(m, r.cells.length), 0);
  const cols = Array.from({ length: colCount }, (_, i) => {
    const w = widths?.[i]
      ?? Math.min(40, Math.max(12, ...rows.map((r) =>
        String(r.cells[i] ?? '').length + 2)));
    return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
  }).join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + (cols ? `<cols>${cols}</cols>` : '')
    + `<sheetData>${body}</sheetData></worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>`
    + `<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
    + `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>`
    + `<borders count="1"><border/></borders>`
    + `<cellStyleXfs count="1"><xf/></cellStyleXfs>`
    + `<cellXfs count="2"><xf xfId="0"/><xf fontId="1" applyFont="1" xfId="0"/></cellXfs>`
    + `</styleSheet>`;

  const blob = zip([
    {
      name: '[Content_Types].xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
        + `<Default Extension="xml" ContentType="application/xml"/>`
        + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
        + `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
        + `</Types>`,
    },
    {
      name: '_rels/.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
        + `</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" `
        + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
        + `<sheets><sheet name="Hisobot" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>`
        + `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
        + `</Relationships>`,
    },
    { name: 'xl/styles.xml', text: styles },
    { name: 'xl/worksheets/sheet1.xml', text: sheet },
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
