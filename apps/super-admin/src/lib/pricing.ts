// =====================================================================
//  Narx formulasi — MIJOZ TOMONIDAGI NUSXA.
//
//  DIQQAT: haqiqiy narxni har doim `public.school_price()` hisoblaydi.
//  Bu yerdagi kod faqat "agar yana bitta filial qo'shsak qancha
//  bo'ladi" degan JONLI hisob uchun — foydalanuvchi maydonni
//  o'zgartirganda serverga so'rov yubormaslik uchun.
//
//  Ikkala tomon bir xil natija berishi SHART. Parametrlar bitta
//  manbadan — `platform_settings` jadvalidan — o'qiladi, shuning
//  uchun raqamlar bu yerda TAKRORLANMAYDI.
//
//    oylik = asos
//          + (filial − 1) × filial_narxi
//          + ceil(max(0, o'quvchi − filial × limit) / qadam) × qadam_narxi
// =====================================================================

export interface BillingParams {
  base_monthly: number;
  branch_price: number;
  students_per_branch: number;
  student_step: number;
  student_step_price: number;
  setup_fee: number;
}

export interface PriceBreakdown {
  branches: number;
  students: number;
  /** Filiallar bergan bepul limit. */
  included: number;
  /** Limitdan oshgan o'quvchilar. */
  extra: number;
  /** Necha qadam to'lanadi. */
  steps: number;
  baseAmount: number;
  branchesAmount: number;
  studentsAmount: number;
  monthlyTotal: number;
}

/** Sozlamalar jadvalidagi qatorlardan parametrlarni yig'adi. */
export function readParams(
  rows: { key: string; value: unknown }[] | null | undefined,
): BillingParams {
  const get = (key: string, fallback: number) => {
    const row = rows?.find((r) => r.key === `billing.${key}`);
    const n = Number(row?.value);
    return Number.isFinite(n) ? n : fallback;
  };
  // Zaxira qiymatlar bazadagi standart bilan bir xil — sozlama
  // o'qilmay qolsa ham ekran bo'sh emas, taxminiy narx ko'rinadi.
  return {
    base_monthly: get('base_monthly', 500000),
    branch_price: get('branch_price', 450000),
    students_per_branch: get('students_per_branch', 250),
    student_step: get('student_step', 50),
    student_step_price: get('student_step_price', 50000),
    setup_fee: get('setup_fee', 600000),
  };
}

export function computePrice(
  branches: number,
  students: number,
  p: BillingParams,
): PriceBreakdown {
  // Filialsiz maktab bo'lmaydi — nolga bo'lishdan himoya.
  const b = Math.max(1, Math.floor(branches) || 1);
  const s = Math.max(0, Math.floor(students) || 0);

  const included = b * p.students_per_branch;
  const extra = Math.max(0, s - included);
  const steps = Math.ceil(extra / p.student_step);

  const baseAmount = p.base_monthly;
  const branchesAmount = (b - 1) * p.branch_price;
  const studentsAmount = steps * p.student_step_price;

  return {
    branches: b,
    students: s,
    included,
    extra,
    steps,
    baseAmount,
    branchesAmount,
    studentsAmount,
    monthlyTotal: baseAmount + branchesAmount + studentsAmount,
  };
}

/**
 * Kechikish kunidan holatni chiqaradi — ro'yxatda qatorni bo'yash
 * uchun. Server bilan bir xil zinapoya.
 */
export function overdueTone(
  days: number | null | undefined,
  grace = 30,
  block = 45,
): 'ok' | 'warn' | 'danger' {
  if (days === null || days === undefined || days < 0) return 'ok';
  if (days < grace) return 'warn';
  if (days < block) return 'danger';
  return 'danger';
}
