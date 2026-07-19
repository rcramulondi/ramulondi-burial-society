/**
 * South African ID number validation.
 *
 * Format: YYMMDD SSSS C A Z (13 digits)
 *  - YYMMDD: date of birth
 *  - SSSS:   0000-4999 female, 5000-9999 male
 *  - C:      citizenship, 0 = SA citizen, 1 = permanent resident
 *  - A:      historically a race indicator, now usually 8 or 9 (not validated)
 *  - Z:      Luhn-style check digit
 */

export type SaIdValidationResult =
  | {
      valid: true;
      dateOfBirth: Date;
      gender: "MALE" | "FEMALE";
      citizen: boolean;
    }
  | { valid: false; reason: string };

function luhnCheckDigit(digits: number[]): number {
  // digits = first 12 digits of the ID number
  let oddSum = 0;
  for (let i = 0; i < 12; i += 2) oddSum += digits[i]; // positions 1,3,5,7,9,11 (0-indexed even)

  let evenConcat = "";
  for (let i = 1; i < 12; i += 2) evenConcat += digits[i]; // positions 2,4,6,8,10,12
  const evenDoubled = String(BigInt(evenConcat || "0") * BigInt(2));
  const evenSum = evenDoubled
    .split("")
    .reduce((sum, ch) => sum + Number(ch), 0);

  return (10 - ((oddSum + evenSum) % 10)) % 10;
}

export function validateSaId(rawId: string): SaIdValidationResult {
  const id = (rawId ?? "").trim();

  if (!/^\d{13}$/.test(id)) {
    return { valid: false, reason: "ID number must be exactly 13 digits." };
  }

  const digits = id.split("").map(Number);
  const checkDigit = luhnCheckDigit(digits);
  if (checkDigit !== digits[12]) {
    return { valid: false, reason: "ID number failed the checksum validation." };
  }

  const yy = id.slice(0, 2);
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return { valid: false, reason: "ID number contains an invalid date of birth." };
  }

  // Disambiguate century: assume the birth year is not in the future.
  const currentYearYY = new Date().getFullYear() % 100;
  const century = Number(yy) > currentYearYY ? 1900 : 2000;
  const dateOfBirth = new Date(Date.UTC(century + Number(yy), mm - 1, dd));
  if (
    dateOfBirth.getUTCFullYear() !== century + Number(yy) ||
    dateOfBirth.getUTCMonth() !== mm - 1 ||
    dateOfBirth.getUTCDate() !== dd
  ) {
    return { valid: false, reason: "ID number contains an invalid date of birth." };
  }

  const genderDigits = Number(id.slice(6, 10));
  const gender: "MALE" | "FEMALE" = genderDigits >= 5000 ? "MALE" : "FEMALE";
  const citizen = id[10] === "0";

  return { valid: true, dateOfBirth, gender, citizen };
}
