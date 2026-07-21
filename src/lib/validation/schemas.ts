import { z } from "zod";
import { validateSaId } from "./saId";
import { validateSaPhone } from "./saPhone";

export const saIdSchema = z
  .string()
  .trim()
  .refine((v) => validateSaId(v).valid, { message: "Invalid South African ID number." });

export const optionalSaIdSchema = z
  .union([z.literal(""), saIdSchema])
  .optional()
  .transform((v) => (v ? v : undefined));

export const saPhoneSchema = z
  .string()
  .trim()
  .refine((v) => validateSaPhone(v).valid, {
    message: "Invalid South African phone number. Use 0821234567 or +27821234567 format.",
  })
  .transform((v) => validateSaPhone(v).normalized);

export const optionalSaPhoneSchema = z
  .union([z.literal(""), saPhoneSchema])
  .optional()
  .transform((v) => (v ? v : undefined));

export const emailSchema = z.string().trim().email("Invalid email address.");

export const optionalEmailSchema = z
  .union([z.literal(""), emailSchema])
  .optional()
  .transform((v) => (v ? v : undefined));

export const genderSchema = z.enum(["MALE", "FEMALE"]);
export const membershipTypeSchema = z.enum(["MAIN", "KHADZI"]);
export const relationshipSchema = z.enum([
  "FATHER",
  "MOTHER",
  "SPOUSE",
  "SON",
  "DAUGHTER",
  "DEPENDENT",
  "OTHER",
]);

export const memberCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required."),
  surname: z.string().trim().min(1, "Surname is required."),
  gender: genderSchema,
  type: membershipTypeSchema,
  idNumber: optionalSaIdSchema,
  phone: saPhoneSchema,
  email: optionalEmailSchema,
  dateJoined: z.coerce.date({ message: "A valid join date is required." }),
  packageNote: z.string().trim().optional(),
});

export const memberUpdateSchema = memberCreateSchema.partial().extend({
  deceasedDate: z.coerce.date().optional().nullable(),
});

export const beneficiaryCreateSchema = z.object({
  memberId: z.string().min(1),
  firstName: z.string().trim().min(1, "First name is required."),
  surname: z.string().trim().min(1, "Surname is required."),
  idNumber: saIdSchema,
  phone: optionalSaPhoneSchema,
  email: optionalEmailSchema,
  relationship: relationshipSchema,
  dateOfBirth: z.coerce.date().optional(),
  isDisabled: z.boolean().optional().default(false),
});

export const payoutNomineeSchema = z.object({
  memberId: z.string().min(1),
  firstName: z.string().trim().min(1, "First name is required."),
  surname: z.string().trim().min(1, "Surname is required."),
  phone: saPhoneSchema,
  bankName: z.string().trim().min(1, "Bank name is required."),
  accountNumber: z.string().trim().min(1, "Account number is required."),
});

export const paymentCreateSchema = z.object({
  memberId: z.string().min(1),
  category: z.enum(["MONTHLY_CONTRIBUTION", "JOINING_FEE"]),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  paymentDate: z.coerce.date(),
  method: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const burialSiteSchema = z.enum(["KHALAVHA", "OTHER"]);

export const claimCreateSchema = z.object({
  memberId: z.string().min(1),
  beneficiaryId: z.string().optional(),
  dateDeceased: z.coerce.date(),
  placeOfBurial: burialSiteSchema,
  payoutRecipientName: z.string().trim().min(1, "Recipient first name is required."),
  payoutRecipientSurname: z.string().trim().min(1, "Recipient surname is required."),
  payoutRecipientIdNumber: saIdSchema,
  payoutRecipientPhone: saPhoneSchema,
  payoutRecipientEmail: optionalEmailSchema,
  bankName: z.string().trim().min(1, "Bank name is required."),
  bankAccountNumber: z.string().trim().min(1, "Account number is required."),
});

export const claimPayoutSchema = z.object({
  claimId: z.string().min(1),
  paidDate: z.coerce.date(),
  paidTo: z.string().trim().min(1),
  notes: z.string().trim().optional(),
});
