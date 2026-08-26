#!/usr/bin/env node
// =====================================================================
//  gen-types.mjs — bazadagi turlarni TypeScript ga ko'chiradi.
//
//  NEGA `supabase gen types --linked` EMAS: `--linked` mahalliy
//  `supabase link` holatiga tayanadi, u esa boshqa kompyuterda yoki
//  keshni tozalagandan keyin yo'qoladi va buyruq xato beradi.
//  Bu skript `db.mjs` bilan bir xil manbadan (.env.local) loyiha
//  raqamini va tokenni oladi — hech narsa sozlash shart emas.
//
//  MUHIM: natija VAQTINCHA faylga yoziladi va faqat muvaffaqiyatli
//  bo'lgandagina joyiga ko'chiriladi. Aks holda `> database.ts`
//  yo'naltirishi buyruq xato bersa ham faylni bo'shatib yuboradi.
// =====================================================================

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps', 'super-admin', 'src', 'types', 'database.ts');
const TMP = `${OUT}.tmp`;

async function loadEnv() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return;
  const text = await readFile(path, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

await loadEnv();

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error(
    'XATO: .env.local da SUPABASE_ACCESS_TOKEN va SUPABASE_PROJECT_REF kerak.',
  );
  process.exit(1);
}

const chunks = [];
const errs = [];

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', REF],
  { env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN }, shell: true },
);

child.stdout.on('data', (d) => chunks.push(d));
child.stderr.on('data', (d) => errs.push(d));

child.on('close', async (code) => {
  const out = Buffer.concat(chunks).toString('utf8');

  // Bo'sh yoki juda qisqa natija — xato demak. Mavjud faylga tegmaymiz.
  if (code !== 0 || out.length < 1000) {
    console.error(Buffer.concat(errs).toString('utf8').trim());
    console.error(`XATO: turlar olinmadi (chiqish kodi ${code}). Fayl o'zgarmadi.`);
    process.exit(1);
  }

  await writeFile(TMP, out, 'utf8');
  await rename(TMP, OUT);
  console.log(`OK — ${out.split('\n').length} qator → src/types/database.ts`);
});
