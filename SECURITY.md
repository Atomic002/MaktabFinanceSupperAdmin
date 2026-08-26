# Xavfsizlik

Bu repo **ochiq**. Quyida nima ochiq, nima yopiq va nega shundayligi
yozilgan.

---

## 1. Repoda NIMA YO'Q

Bu uchtasi hech qachon git'ga tushmaydi va tushmasligi ham kerak:

| Kalit | Qayerda saqlanadi | Qo'lga tushsa nima bo'ladi |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | faqat `.env.local` | **Halokat.** RLS ni butunlay chetlab o'tadi — barcha maktablarning barcha ma'lumoti |
| `SUPABASE_ACCESS_TOKEN` (`sbp_…`) | faqat `.env.local` | **Halokat.** Management API — bazani o'chirib yuborish mumkin |
| Telegram bot tokeni | Edge Function maxfiy kaliti | Ota-onalarga soxta xabar yuborish |

`.gitignore` barcha `.env*` fayllarni to'sadi, `!.env.example` dan
boshqa. Har bir build oldidan `scripts/check-secrets.mjs` ishlaydi va
kuzatilayotgan fayllarda kalit izini topsa **CI ni yiqitadi**.

> Kalit tasodifan commit qilinsa, uni faqat o'chirish **yetarli
> emas** — u git tarixida qoladi. Bunday holatda kalitni Supabase
> panelidan **almashtirish** shart.

---

## 2. Repoda NIMA BOR va nega bu xavfsiz

### Kod, migratsiyalar, RLS siyosatlari

Butun xavfsizlik modeli ochiq: jadvallar, siyosatlar, RPC lar. Bu
ataylab — **himoya kod sirligiga tayanmaydi**.

Ikkita qatlam bor va ikkalasi ham serverda:

- **JWT** — foydalanuvchi kimligi, Supabase Auth imzolaydi;
- **RLS** — qaysi qatorlarni ko'rishi, PostgreSQL darajasida.

So'rov qayerdan kelishi ahamiyatsiz — panel, `curl`, yoki
to'g'ridan-to'g'ri PostgREST. Siyosat bir xil ishlaydi. Kodni o'qigan
odam qanday ishlashini biladi, lekin bu unga hech qanday kirish
bermaydi.

### Publishable kalit

`VITE_SUPABASE_PUBLISHABLE_KEY` — brauzerga chiqadigan kalit. U
**repoda emas**: build vaqtida GitHub Actions secret'idan yoziladi
(`.github/workflows/deploy.yml`).

> **Bu kalitni SIR QILMAYDI.** U tayyor saytning JS faylida baribir
> turadi va uni har kim o'qiy oladi — shunday bo'lishi kerak ham.
> Secret'ga ko'chirishning ikkita amaliy foydasi bor: repo kalitni
> tayyor holda uzatmaydi, va kalit almashtirilganda bitta joy
> o'zgaradi.
>
> Publishable kalit o'z-o'zicha hech narsa ochmaydi: u bilan qilingan
> har bir so'rov baribir RLS dan o'tadi.

---

## 3. Platforma qatlamining qoidalari

- **Super admin mijoz ma'lumotini ko'rmaydi.** `platform_schools()` va
  `platform_school_card()` faqat jamlangan raqam va sana qaytaradi.
- **Yozish siyosati yo'q.** Yangi jadvallarda faqat `SELECT`. Har bir
  o'zgarish `SECURITY DEFINER` RPC orqali va har biri
  `platform_log` ga yozadi — jurnalsiz o'zgarish imkonsiz.
- **`platform_admins` ga ilova orqali yozib bo'lmaydi** — INSERT
  siyosati umuman yaratilmagan. Yangi operator faqat buyruq satridan.
- **Jurnal o'chirilmaydi** — `DELETE` huquqi hech qayerda berilmagan.
- **Texnik yordam sessiyasi** ikkita jurnalga tushadi va **maktab
  direktoriga ko'rinadi**.

Bazaning o'zida `app.security_invariants()` funksiyasi o'nta qoidani
tekshiradi va biror biri buzilsa xato tashlaydi.
`scripts/test-platform.sql` har safar uni chaqiradi — hatto
invariantlar **soni** ham sanaladi, shunda kelajakda tekshiruv
jimgina olib tashlanmasin.

---

## 4. Kalit almashtirish kerak bo'lsa

1. Supabase panelida yangi kalit oling
   (Settings → API yoki Account → Access Tokens).
2. Eskisini **bekor qiling** — yangi kalit yaratish eskisini
   o'chirmaydi.
3. `.env.local` ni yangilang.
4. Publishable kalit bo'lsa: GitHub → Settings → Secrets and
   variables → Actions → `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. `npm run audit` bilan hammasi ishlayotganini tekshiring.

---

## 5. Zaiflik topsangiz

Ochiq muhokamaga (issue) **yozmang**. Pochta: uztomic@gmail.com
