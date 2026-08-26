// =====================================================================
//  password.mjs — hisob uchun parol yaratadi.
//
//  MUHIM: Supabase parol siyosati (scripts/harden-auth.mjs) TALAB
//  qiladi:
//    · kamida 12 ta belgi
//    · kamida bitta kichik harf, bitta katta harf, bitta raqam
//
//  Shartlarni tasodifga qoldirib bo'lmaydi: 12 ta tasodifiy belgi
//  ichida raqam umuman bo'lmasligi mumkin va Admin API parolni rad
//  etadi — hisob yaratilmay, maktab yarim holatda qolib ketardi.
//  Shuning uchun har bir sinfdan bittasi KAFOLATLANADI, qolgani
//  to'ldiriladi va oxirida aralashtiriladi.
//
//  Chalkashadigan belgilar yo'q: I/l/1, O/0. Parol telefonda
//  qo'lda teriladi va og'zaki aytiladi.
// =====================================================================

const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const ALL = LOWER + UPPER + DIGIT;

/** Kriptografik tasodifiy son — Math.random() emas. */
function pick(alphabet) {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return alphabet[b[0] % alphabet.length];
}

export function generatePassword(length = 14) {
  if (length < 12) length = 12;

  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT)];
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher-Yates: kafolatlangan uchtasi boshida turib qolmasin.
  for (let i = chars.length - 1; i > 0; i--) {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    const j = b[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
