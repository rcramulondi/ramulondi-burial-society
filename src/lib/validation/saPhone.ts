/**
 * South African phone number normalization/validation.
 * Accepts local (0xxxxxxxxx) or international (+27xxxxxxxxx) forms,
 * covering mobile (06/07/08 prefixes) and landline (01-05) numbers.
 */

const SA_PHONE_REGEX = /^\+27[1-9]\d{8}$/;

export function normalizeSaPhone(raw: string): string {
  const cleaned = (raw ?? "").replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+27")) return cleaned;
  if (cleaned.startsWith("0027")) return "+27" + cleaned.slice(4);
  if (cleaned.startsWith("0")) return "+27" + cleaned.slice(1);
  return cleaned;
}

export function validateSaPhone(raw: string): { valid: boolean; normalized: string } {
  const normalized = normalizeSaPhone(raw);
  return { valid: SA_PHONE_REGEX.test(normalized), normalized };
}
