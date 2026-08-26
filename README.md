# MaktabFinance — Super admin paneli

Uztomic Solutions xodimlari uchun platforma boshqaruvi: maktablarni
ulash, obunani yuritish, to'lovni kuzatish, texnik yordam ko'rsatish.

Maktab paneli alohida loyihada: `../../Xususiy Maktablar Moliya  Tizmi`
(repo: `github.com/uztomic/MaktabFinance`).

> **Nega alohida ilova.** Maktab paneliga super admin kodi hech qachon
> tushmasligi kerak. Bitta ilovada rol bo'yicha yashirish yetarli emas —
> kod baribir brauzerga yuklanadi va uni o'qish mumkin.

---

## 1. Nima qilingan

| | |
|---|---|
| Ilova | React 19 + TypeScript + Vite 7 + Tailwind 4 |
| Sahifalar | 7 ta (ko'rsatkichlar, maktablar, kartochka, ulash, to'lovlar, yozishma, jurnal, sozlamalar, operatorlar) |
| Til | uz / uz-cyrl / ru — 365 ta kalit |
| Migratsiya | 14 ta (`20260826120000` … `20260826150003`) |
| Yangi jadval | 5 ta, hammasida RLS |
| Yangi funksiya | 28 ta |
| Edge Function | `platform-ops` |
| Cron | `maktab_billing_cycle` — har kuni 02:00 UTC (07:00 Toshkent) |

**Baza bitta.** Migratsiyalar shu repodan qo'llanadi, lekin tarix
`supabase_migrations.schema_migrations` da — maktab paneli ishlatadigan
aynan o'sha jadvalda. Versiya raqamlari to'qnashmaydi.

---

## 2. Narx modeli

```
oylik = asos
      + (filial − 1) × filial_narxi
      + ceil(max(0, o'quvchi − filial × 250) / 50) × qadam_narxi
```

| Parametr | Standart |
|---|---:|
| Ulanish to'lovi (bir marta) | 600 000 |
| Asosiy oylik (1 filial, 250 o'quvchi) | 500 000 |
| Har qo'shimcha filial | 450 000 |
| Filial beradigan o'quvchi limiti | 250 |
| Har 50 ta ortiqcha o'quvchi | 50 000 |

**Har bir filial 250 o'quvchi limitini BERADI.** Ya'ni 2 filialli
maktabda 500 o'quvchigacha qo'shimcha to'lov yo'q.

Misollar:

| Filial | O'quvchi | Hisob | Oylik |
|---:|---:|---|---:|
| 1 | 180 | 500 000 | **500 000** |
| 1 | 250 | 500 000 | **500 000** |
| 1 | 251 | 500 000 + ⌈1/50⌉×50 000 | **550 000** |
| 1 | 340 | 500 000 + ⌈90/50⌉×50 000 | **600 000** |
| 2 | 400 | 500 000 + 450 000 | **950 000** |
| 2 | 610 | 500 000 + 450 000 + ⌈110/50⌉×50 000 | **1 100 000** |

**Yaxlitlash yuqoriga.** Bitta ortiqcha o'quvchi ham to'liq 50 000
turadi — buni mijozga oldindan aytish kerak, aks holda bahs chiqadi.

**O'quvchi soni oy boshida bir marta o'lchanadi**, faqat `active`
holatdagilar. Akademik ta'tildagilar va chiqib ketganlar sanalmaydi.
O'lchangan son hisob-fakturaga muzlatib yoziladi — "o'sha oyda 340 ta
bola bor edi" degani hujjatda qoladi.

Narxlar `platform_settings` jadvalida — o'zgartirish uchun migratsiya
kerak emas, panelning "Sozlamalar" bo'limidan yangilanadi va har bir
o'zgarish `platform_log` ga tushadi.

---

## 3. Bloklash zinapoyasi

To'lov kechikkanda maktab bosqichma-bosqich cheklanadi. **Ma'lumot
hech qachon o'chirilmaydi** — faqat qaytarilmaydi.

| Kechikish | Maktab | Obuna | Nima bo'ladi |
|---|---|---|---|
| muddat kelmagan | `active` | `active` | hammasi ishlaydi |
| 15 kun | `active` | `active` | birinchi eslatma |
| 30 … 44 kun | `active` | `grace` | ikkinchi eslatma, hammasi ishlaydi |
| 45+ kun | `restricted` | `restricted` | panelga KIRA OLMAYDI |

`restricted` — oxirgi bosqich. Panel oddiy ekranlarni umuman
ko'rsatmaydi: `SuspendedShell` ochiladi va u uchta narsani aytadi —
nima bo'ldi, ma'lumot yo'qolmadi, nima qilish kerak. Yonida
qarzdorlik summasi, kechikish kuni va to'lov rekvizitlari turadi.

**Bloklash `AuthProvider` darajasida, RLS da EMAS** (TZ 2.4). Baza
o'qishga ochiq qoladi — yozish esa `app.school_is_writable()` bilan
allaqachon to'silgan. Sabab TZ da ikki marta yozilgan: RLS ni yopib
qo'ysangiz direktor to'lov ekranini ham ko'ra olmaydi va tizim boshi
berk ko'chaga kiradi.

**To'lov tasdiqlangan zahoti hammasi qaytadi.** Buni sinov
tekshiradi (`test-platform.sql`, 2-bo'lim).

Muddatlar `billing.first_reminder_days`, `billing.grace_days` va
`billing.block_days` da — panelning "Sozlamalar" bo'limidan
o'zgartiriladi.

---

## 4. To'lov oqimi

```
maktab                          ijrochi
──────                          ───────
chek rasmini yuklaydi
summa va sanani kiritadi
        │
        ├─→ subscription_payments (status = pending)
        │   OBUNAGA TA'SIR QILMAYDI
        │
        └─→ support_threads da mavzu ochiladi
                                  │
                                  ├─ chekni ko'radi (5 daqiqalik havola)
                                  │
                    tasdiqlaydi ──┤── rad etadi (SABAB majburiy)
                          │       │           │
                          │       │           └─→ sabab maktabga
                          │       │               yozishma orqali boradi
                          ▼
              next_payment_date siljiydi
              hisob-fakturalar yopiladi
              maktab holati qayta hisoblanadi
              maktabga tizim xabari yuboriladi
```

Ijrochi bankdan pulni ko'rib **qo'lda** ham belgilashi mumkin
(maktab kartochkasi → "To'lovni belgilash"). Ikkala yo'l ham bir xil
funksiyaga tushadi — obuna bir xil uzayadi.

---

## 5. Xavfsizlik

Maktab loyihasidagi **o'nta invariant buzilmagan** — `test-platform.sql`
har safar ularni tekshiradi va soni 10 ta ekanini ham sanaydi.

Qo'shimcha qoidalar:

- **Super admin mijoz ma'lumotini ko'rmaydi.** `platform_schools()` va
  `platform_school_card()` faqat jamlangan raqam va sana qaytaradi.
  O'quvchi ismi, qarzdorlik, to'lov summasi — yo'q.
- **Ichki moliyani ko'rishning yagona yo'li** — texnik yordam
  sessiyasi. U ikkita jurnalga tushadi (`impersonation_log` +
  `platform_log`) va **maktab direktoriga ko'rinadi**.
- **Yozish siyosati yo'q.** Yangi jadvallarning hammasida faqat
  `SELECT`. Har bir o'zgarish `security definer` RPC orqali va har
  biri `platform_log` ga yozadi.
- **`platform_admins` ga ilova orqali yozib bo'lmaydi** — INSERT
  siyosati umuman yaratilmagan. Yangi operator faqat buyruq satridan.
- Barcha yangi RPC da `search_path = ''` va `revoke ... from anon`.
- Barcha siyosatda funksiya chaqiruvi `(select ...)` ichida.

---

## 6. Ishga tushirish

```bash
npm install
npm run dev              # 5174-portda
```

Ikkita muhit fayli kerak va **ikkalasi ham repoda yo'q** —
`.env.example` dan nusxa oling:

| Fayl | Nima yoziladi |
|---|---|
| `.env.local` | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` — skriptlar uchun |
| `apps/super-admin/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SCHOOL_PANEL_URL` — brauzer uchun |

Ishlab chiqarish build'i uchun `apps/super-admin/.env.production`
kerak, lekin uni **qo'lda yaratmaysiz**: GitHub Actions uni har bir
chiqarishda o'z secret'laridan yozadi. Repo ochiq bo'lgani uchun
hech qanday `.env` fayl git'ga tushmaydi — `SECURITY.md` ga qarang.

### Baza

```bash
npm run db:status        # qaysi migratsiya qo'llangan
npm run db:dry           # HAMMASINI jonli bazada sinash (rollback bilan)
npm run db:push          # kutayotganlarini qo'llash
npm run db:types         # bazadan TypeScript turlari
```

> **`db:dry` ni push dan oldin ishlating.** Bu migratsiyalar 100 dan
> ortiq RLS siyosatini qayta yozadi. Skript faylni
> `begin ... rollback` ichida bajaradi: sintaksis, ustun nomlari va
> `raise exception` bilan yozilgan tekshiruvlar haqiqiy bazada
> sinaladi, natija esa bekor qilinadi.

### Sinov

```bash
npm run test:db          # platforma mantiqi (o'zi rollback qiladi)
npm run audit            # kod + sirlar + i18n + baza sinovi
node scripts/smoke-platform.mjs uztomic@gmail.com director@maktab.uz
```

`smoke-platform.mjs` **haqiqiy token** bilan ikkala rolni tekshiradi:
super admin hamma narsani ko'radimi va direktor **begona narsani
ko'rmasligini**. Parol so'ralmaydi — bir martalik sehrli havola
ishlatiladi, hech kimning paroli o'zgarmaydi.

### Edge Function

```bash
npm run fn:deploy
```

### Yangi operator qo'shish

```bash
npm run new-admin -- "Ism Familiya" pochta@uztomic.uz
```

---

## 7. Tuzilish

```
├─ supabase/
│  ├─ migrations/          14 ta migratsiya
│  └─ functions/
│     └─ platform-ops/     impersonation + maktab ulash + parol tiklash
├─ apps/
│  └─ super-admin/         Vite + React + TypeScript + Tailwind
│     └─ src/
│        ├─ auth/          platforma admini konteksti
│        ├─ layout/        qobiq va boshqaruv elementlari
│        ├─ ui/            primitivlar (maktab panelidan nusxa)
│        ├─ lib/           supabase, format, narx formulasi
│        ├─ i18n/          uz / uz-cyrl / ru
│        └─ features/      7 ta ekran
└─ scripts/                baza, sinov va joylashtirish asboblari
```

---

## 8. Qaror izohlari

### Nega narx formulada, tarifda emas

`plans` jadvali qat'iy tarif beradi: "Asosiy 500 000, 300 o'quvchi".
Amalda narx maktab O'LCHAMIGA qarab o'sadi. Har bir kombinatsiya uchun
alohida tarif — yuzlab qator. Formula esa bitta. Tarif faqat
cheklovlar (`max_students`, `max_branches`) uchun qoldirildi.

### Nega hisob-faktura alohida jadval

`school_subscriptions` da faqat joriy holat bor. "O'tgan may oyida
qancha hisoblangan edi" degan savolga javob yo'q. Hisob-faktura —
o'zgarmas hujjat: chiqarilgan paytdagi filial soni, o'quvchi soni va
narxlar unda **muzlatiladi**.

### Nega bloklash RLS dan AuthProvider ga ko'chirildi

Dastlab bloklash 45 ta RLS siyosatiga qo'shilgan edi — bloklangan
maktab ma'lumotni `curl` bilan ham ololmasdi. TZ 2.4 buni ataylab
rad etadi va sababini ikki marta yozadi: RLS ni yopib qo'ysangiz
direktor to'lov ekranini ham ko'ra olmaydi va tizim boshi berk
ko'chaga kiradi.

Amaliy sabab ham bor: 45 ta siyosatga qo'shilgan shart har bir
kelajakdagi migratsiyada hisobga olinishi kerak edi. Kim bo'lmasin
yangi jadval qo'shsa va shartni unutsa, bloklash o'sha jadvalda
ishlamay qolardi — va buni hech kim sezmasdi.

Bloklash — tijorat richagi, maxfiylik chegarasi emas: maktabning
o'z ma'lumoti undan sir emas. 48-migratsiyaga qarang.

### Nega bloklangan maktab yozishma va chek yuborishni saqlaydi

Aks holda tuzoq bo'lardi: maktab bloklangan, to'lovni bildirish yo'li
yopiq, gaplashib ham bo'lmaydi. Migratsiya 41 dagi `v_allow` ro'yxati
aynan shuning uchun bor.

### Nega `guard_school_status` server kontekstini tan olishi kerak edi

Trigger `app.is_platform_admin()` ga tayanardi, u esa `auth.uid()` ga.
Cron da JWT yo'q — `auth.uid()` null, funksiya `false` qaytaradi va
**trigger o'z serverimizni to'xtatardi**. Ya'ni avtomatik bloklash
umuman ishlamas edi va buni faqat 45 kundan keyin sezgan bo'lardik.
Sinov shuni topdi (migratsiya 46).

### Nega `app.plog` chaqiruvchini tekshiradi

`platform_log.admin_id` da `platform_admins` ga FK bor. Bu jurnalga
maktab ham sabab bo'ladi (direktor chek yuborganda) va o'shanda
`auth.uid()` direktorning ID si — u `platform_admins` da yo'q.
Shartsiz yozilsa `23503` chiqardi: **direktor chek yubora olmasdi**,
ya'ni bloklangan holatdan chiqish eshigi ham qulflanardi.

---

## 9. Uslub

Maktab loyihasi bilan bir xil:

- Izohlar o'zbekcha, kod inglizcha. Izoh "nima" emas, **"nega"**.
- Interfeys matni faqat i18n orqali (`npm run audit:code` tekshiradi).
- Yozuv o'chirilmaydi — `deleted_at` yoki holat.
- Moliyaviy amal faqat RPC orqali, RLS ochilmaydi.
- Har bir migratsiya sarlavhasida muammo va yechim tushuntiriladi.
- Minimalistik, zich interfeys.
