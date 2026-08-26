#!/usr/bin/env node
// =====================================================================
//  audit-code.mjs — kod bo'yicha tekshiruv.
//
//  `tsc` turlarni tekshiradi, `i18n-check` yetishmayotgan kalitni
//  topadi. Lekin ikkalasi ham SEZMAYDIGAN xatolar bor:
//
//    · interfeysda qattiq yozilgan o'zbekcha matn (TZ 5.4.19 —
//      barcha matn i18n orqali kelishi shart, aks holda ruscha
//      interfeysda o'zbekcha so'z chiqib qoladi);
//    · menyuda bor, lekin marshruti yo'q sahifa (bosilsa bosh
//      sahifaga otib yuboradi);
//    · panel chaqiradigan, lekin bazada yo'q RPC;
//    · unutilgan `console.log` va `TODO`.
//
//  Bo'sh natija = toza.
//
//    node scripts/audit-code.mjs
// =====================================================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'apps/super-admin/src';
const findings = [];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(SRC).filter((f) => /\.tsx?$/.test(f));
const rel = (f) => f.replace(/\\/g, '/').replace(SRC + '/', '');

function add(kind, file, line, detail) {
  findings.push({ kind, file: rel(file), line, detail });
}

// =====================================================================
//  1. QATTIQ YOZILGAN MATN
//
//  JSX ichidagi va `label=` / `hint=` / `placeholder=` / `title=`
//  atributlaridagi o'zbekcha matn. Aniqlash belgisi: o'zbek
//  alifbosiga xos harflar yoki uch va undan ortiq so'z.
// =====================================================================

/** Kod emas, MATN ekanini bildiruvchi belgilar. */
const UZ_HINT = /[‘’']|\b(va|uchun|bilan|emas|yoki|kerak|bo|qilish|qo|ko)\b/i;

function isUzbekText(s) {
  const t = s.trim();
  if (t.length < 8) return false;
  // Texnik satrlar — yo'l, sinf nomi, kalit, format.
  if (/^[a-z0-9_.:/-]+$/i.test(t)) return false;
  if (/^[\d\s.,%-]+$/.test(t)) return false;
  // Kamida ikkita so'z va o'zbekcha belgi.
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return UZ_HINT.test(t);
}

for (const f of files) {
  // i18n lug'atlari va sozlash fayllari tekshirilmaydi.
  if (/i18n[\\/]|types[\\/]/.test(f)) continue;

  const lines = readFileSync(f, 'utf8').split('\n');
  let inBlockComment = false;

  lines.forEach((line, i) => {
    // Izohlarni tashlab yuboramiz — ular o'zbekcha bo'lishi KERAK.
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      return;
    }
    //  `{/* … */}` — JSX ichidagi izoh. U ham bir necha qatorga
    //  cho'zilishi mumkin va ichidagi o'zbekcha matn IZOH, kod emas.
    if (trimmed.startsWith('/*') || trimmed.startsWith('{/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    // `label="..."`, `hint="..."`, `placeholder="..."`, `title="..."`
    for (const m of line.matchAll(
      /\b(label|hint|placeholder|title|message|warning)=["']([^"'{]{8,})["']/g)) {
      if (isUzbekText(m[2])) {
        add('QATTIQ MATN', f, i + 1, `${m[1]}="${m[2].slice(0, 55)}"`);
      }
    }

    // JSX ichidagi ochiq matn: `>Matn<`.
    // `{a > 0 ? 'x' : 'y'}` kabi ifodalar bu naqshga tushadi, lekin
    // ular MATN emas — shartli ifoda. Tashlab yuboramiz.
    if (/[?:]\s*['"`]/.test(line)) return;
    for (const m of line.matchAll(/>([^<>{}\n]{10,})</g)) {
      if (isUzbekText(m[1])) {
        add('QATTIQ MATN', f, i + 1, `>${m[1].trim().slice(0, 55)}<`);
      }
    }

    //  ALOHIDA QATORDAGI JSX MATNI.
    //
    //  Yuqoridagi naqsh `>Matn<` ni qidiradi — ya'ni matn ochilish va
    //  yopilish teglari bilan BIR QATORDA bo'lishini kutadi. Uzun
    //  matnda esa teg oldingi qatorda qoladi:
    //
    //      <Notice tone="neutral">
    //        Hisoblanmagan o'qituvchilar: {list.join(', ')}
    //      </Notice>
    //
    //  Bunday qator birinchi tekshiruvdan bemalol o'tib ketardi va
    //  ruscha interfeysda o'zbekcha so'z bo'lib chiqardi. Aynan shu
    //  hol Payroll.tsx da topilgan.
    if (!f.endsWith('.tsx')) return;

    //  Kodni ajratuvchi belgilar. Apostrof BU RO'YXATDA YO'Q — u
    //  o'zbek matnining eng ishonchli belgisi ("o'qituvchi"), uni
    //  chiqarib tashlash tekshiruvni ko'r qilib qo'yadi.
    if (/\?\?|\?\.|=>|\|\||&&|[=;]/.test(trimmed)) return;
    if (/[,;]$/.test(trimmed)) return;

    //  Kalit so'z bilan boshlangan qator — bu ko'rsatma, matn emas.
    //  `case 'month':` kabi qatorlar aks holda "o'zbekcha matn" deb
    //  belgilanardi: ular ham harf bilan boshlanadi va apostrof bor.
    if (/^(case|return|const|let|var|if|else|for|while|do|switch|break|continue|import|export|default|function|type|interface|enum|class|new|throw|try|catch|finally|await|async|yield|typeof|delete|void|in|of|as|from|extends|implements)\b/
      .test(trimmed)) return;

    //  Matn qatori HARF bilan boshlanadi va `{` da yoki qator
    //  oxirida tugaydi.
    //  Qo'shtirnoq MATNDA uchraydi ("...sanasini qo'ying" kabi
    //  jumlada tirnoq ichiga olingan so'z). Uni chiqarib tashlash
    //  tekshiruvni ko'r qiladi: aynan shunday qator Reports.tsx da
    //  topilmay qolgan edi. Atributdan ajratish uchun `=` allaqachon
    //  yuqorida rad etilgan.
    const jsx = trimmed.match(/^([A-Za-z][^<>{}`()[\]]{9,}?)\s*(?:\{|$)/);
    if (jsx && isUzbekText(jsx[1])) {
      add('QATTIQ MATN', f, i + 1, jsx[1].trim().slice(0, 55));
    }
  });
}

// =====================================================================
//  2. MENYU ↔ MARSHRUT MOSLIGI
// =====================================================================

const shell = readFileSync(join(SRC, 'layout/AppShell.tsx'), 'utf8');
const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');

const menuPaths = [...shell.matchAll(/to:\s*'\/([a-z-]*)'/g)].map((m) => m[1]);
const routePaths = [...app.matchAll(/path="([a-z-]+)"/g)].map((m) => m[1]);

for (const p of new Set(menuPaths)) {
  if (p === '') continue;                       // bosh sahifa — `index`
  if (!routePaths.includes(p)) {
    add('MENYUDA BOR, MARSHRUT YO‘Q', 'layout/AppShell.tsx', 0, `/${p}`);
  }
}

// Qidiruv palitrasidagi sahifalar ham marshrutga ega bo'lishi kerak.
//  Super admin panelida qidiruv palitrasi YO'Q — sahifalar soni
//  ettita, ularni qidirish uchun tezkor buyruq ortiqcha. Fayl
//  bo'lmasa tekshiruv tashlab yuboriladi, aks holda audit umuman
//  ishga tushmaydi.
const palettePath = join(SRC, 'ui/CommandPalette.tsx');
if (existsSync(palettePath)) {
  const palette = readFileSync(palettePath, 'utf8');
  for (const m of palette.matchAll(/to:\s*'\/([a-z-]*)'/g)) {
    if (m[1] === '') continue;
    if (!routePaths.includes(m[1])) {
      add('QIDIRUVDA BOR, MARSHRUT YO‘Q', 'ui/CommandPalette.tsx', 0, `/${m[1]}`);
    }
  }
}

// =====================================================================
//  3. RPC VA JADVAL NOMLARI — turlar faylida bormi
// =====================================================================

const types = readFileSync(join(SRC, 'types/database.ts'), 'utf8');

for (const f of files) {
  if (/types[\\/]/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\.rpc\(\s*'([a-z_0-9]+)'/g)) {
      if (!new RegExp(`^\\s{6}${m[1]}: \\{`, 'm').test(types)) {
        add('RPC BAZADA YO‘Q', f, i + 1, m[1]);
      }
    }
    // `supabase.storage.from('receipts')` — bu BUCKET, jadval emas.
    // Zanjir ikki qatorga bo'linishi mumkin, shuning uchun oldingi
    // qatorga ham qaraymiz.
    const prev = i > 0 ? lines[i - 1] : '';
    if (/\.storage\b/.test(line) || /\.storage\s*$/.test(prev.trimEnd())) return;
    for (const m of line.matchAll(/\.from\(\s*'([a-z_0-9]+)'\s*\)/g)) {
      if (!new RegExp(`^\\s{6}${m[1]}: \\{`, 'm').test(types)) {
        add('JADVAL BAZADA YO‘Q', f, i + 1, m[1]);
      }
    }
  });
}

// =====================================================================
//  4. UNUTILGAN IZLAR
// =====================================================================

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // `import.meta.env.DEV` ichidagi console — ataylab qo'yilgan
    // ishlab chiqish vositasi, u ishlab chiqarish build'iga tushmaydi.
    const inDevGuard = lines.slice(Math.max(0, i - 3), i)
      .some((l) => /import\.meta\.env\.DEV/.test(l));
    if (/\bconsole\.(log|debug|warn)\(/.test(line)
        && !line.trim().startsWith('//') && !inDevGuard) {
      add('CONSOLE QOLDIQ', f, i + 1, line.trim().slice(0, 60));
    }
    if (/\b(TODO|FIXME|XXX|HACK)\b/.test(line)) {
      add('BELGI', f, i + 1, line.trim().slice(0, 60));
    }
    if (/\bdebugger\b/.test(line)) {
      add('DEBUGGER', f, i + 1, line.trim().slice(0, 60));
    }
  });
}

// =====================================================================
//  5. ISHLATILMAYDIGAN FAYL
// =====================================================================

for (const f of files) {
  const name = f.replace(/\\/g, '/').split('/').pop().replace(/\.tsx?$/, '');
  // Ambient turlar va kirish nuqtalari hech qayerdan import qilinmaydi
  // — bu normal holat, kamchilik emas.
  if (['main', 'App', 'vite-env', 'database'].includes(name)) continue;
  if (f.endsWith('.d.ts')) continue;

  const referenced = files.some((other) => {
    if (other === f) return false;
    const text = readFileSync(other, 'utf8');
    return new RegExp(`['"/]${name}['"]|/${name}'`).test(text);
  });

  if (!referenced) add('ISHLATILMAYDIGAN FAYL', f, 0, '');
}

// =====================================================================
//  NATIJA
// =====================================================================

console.log(`\nTekshirilgan fayl: ${files.length}\n`);

if (findings.length === 0) {
  console.log('  ✓ Kamchilik topilmadi\n');
  process.exit(0);
}

const byKind = new Map();
for (const x of findings) {
  if (!byKind.has(x.kind)) byKind.set(x.kind, []);
  byKind.get(x.kind).push(x);
}

for (const [kind, items] of byKind) {
  console.log(`  ${kind} — ${items.length} ta`);
  for (const x of items.slice(0, 25)) {
    console.log(`    ${x.file}${x.line ? ':' + x.line : ''}  ${x.detail}`);
  }
  if (items.length > 25) console.log(`    … yana ${items.length - 25} ta`);
  console.log('');
}

console.log(`  Jami: ${findings.length}\n`);
process.exit(1);
