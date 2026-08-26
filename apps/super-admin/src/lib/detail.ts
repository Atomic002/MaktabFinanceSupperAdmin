// =====================================================================
//  Jurnal tafsilotini o'qiladigan matnga aylantirish.
//
//  MUAMMO. `platform_log.before/after` — bu JSONB va jadval katagida
//  xom holda chiqarilardi:
//
//      {"errors":0,"period":"2026-08-01","by_user":null,"changed":0,
//       "invoiced":0,"reminded":0,"by_platform":false}
//
//  Ustun tor bo'lgani uchun matn yarmida kesilardi va aslida hech
//  narsa ko'rinmasdi — na nechta hisob-faktura chiqarilgani, na
//  nechta eslatma ketgani. Ya'ni "Tafsilot" ustuni joy egallab
//  turardi, lekin savolga javob bermasdi.
//
//  YECHIM. Kalitlar nomlanadi, qiymatlari tarjima qilinadi, texnik
//  maydonlar tashlab yuboriladi.
//
//  NEGA BUTUNLAY OLIB TASHLANMAYDI: jurnal — dalil. Nizoli holatda
//  "kim, qachon, nimani o'zgartirdi" degan savolga javob shu yerdan
//  olinadi, shuning uchun ma'lumot yo'qolmasligi kerak — faqat
//  o'qiladigan bo'lishi kerak.
// =====================================================================

type T = (key: string) => string;

/** Tarjima bormi? `t()` topolmasa kalitning o'zini qaytaradi. */
function tryT(t: T, key: string): string | null {
  const v = t(key);
  return v === key ? null : v;
}

//  Bu maydonlar ko'rsatilmaydi:
//
//    · `by_user`, `ended_by`, `started_by` — UUID. Operator ismi
//      allaqachon alohida ustunda turibdi;
//    · `by_platform` — ichki bayroq, amal turidan bilinadi;
//    · `school_id`, `id` — havola sifatida alohida ustunda.
const HIDE = new Set([
  'by_user', 'by_platform', 'ended_by', 'started_by',
  'school_id', 'id', 'admin_id', 'user_id',
]);

//  Qiymatning O'ZI kod bo'lgan maydonlar.
const VALUE_PREFIX: Record<string, string> = {
  status: 'subStatus.',
  school_status: 'subStatus.',
  subscription_status: 'subStatus.',
  invoice_status: 'invStatus.',
  payment_status: 'payStatus.',
};

function labelFor(t: T, key: string): string {
  return tryT(t, `pdet.${key}`) ?? key.replace(/_/g, ' ');
}

function valueFor(t: T, key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');

  if (typeof v === 'string') {
    const prefix = VALUE_PREFIX[key];
    if (prefix) {
      const translated = tryT(t, prefix + v);
      if (translated) return translated;
    }
    //  Sana yoki vaqt bo'lsa qisqartiriladi: to'liq ISO satri
    //  katakka sig'maydi va o'qilmaydi ham.
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
    return v;
  }

  if (typeof v === 'object') {
    const n = Array.isArray(v) ? v.length : Object.keys(v).length;
    return `{${n}}`;
  }
  return String(v);
}

/**
 *  Tafsilotni "Nomi: qiymat · Nomi: qiymat" ko'rinishiga keltiradi.
 *  Bo'sh bo'lsa `null` qaytadi — chaqiruvchi tire qo'yadi.
 */
export function detailText(t: T, source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;

  const parts: string[] = [];
  for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
    if (HIDE.has(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    parts.push(`${labelFor(t, k)}: ${valueFor(t, k, v)}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}
