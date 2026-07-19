# Ramulondi Burial Society — Membership & Claims Management

A membership, contributions, and claims management application for the Ramulondi Burial Society, built with Next.js (App Router), Prisma, and PostgreSQL.

## What this replaces

Previously, membership, contributions, and claims were tracked in an Excel workbook with formula-driven status/lapse logic. This app replaces that with:

- A member self-service portal (profile, beneficiaries, contribution history, claims).
- An admin portal (full member/beneficiary/claims/rates management, audit log).
- Automatic membership status derivation (Active / About to lapse / Lapsed-terminated / Deceased), mirroring the spreadsheet's logic but corrected for edge cases (e.g. mid-year joiners).
- A real contributions ledger that can apportion lump-sum payments across outstanding months and funds (Burial + Food), even across a rate change.
- A structured claims workflow with cooling-off period, arrears checks, and admin approval before payout.

## Tech stack

- **Framework**: Next.js 16 (App Router, TypeScript, Server Actions)
- **Database**: PostgreSQL via Prisma ORM 6
- **Auth**: Auth.js (NextAuth) v5, credentials provider (email/phone + password), JWT sessions
- **File storage**: Vercel Blob (private access enforced at the application layer — see `src/lib/storage/blob.ts`)
- **Validation**: Zod, with hand-written SA ID number (Luhn-style checksum) and SA phone number validators
- **Testing**: Vitest (unit tests for business logic), Playwright (used ad hoc for E2E verification during development)

## Local development

1. **Install dependencies**: `npm install`
2. **Set up environment variables**: copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` / `DIRECT_URL` — a Postgres instance (e.g. a free [Neon](https://neon.tech) project). `DATABASE_URL` is the pooled connection, `DIRECT_URL` the direct one used for migrations.
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `CRON_SECRET` — any random string, generate with `openssl rand -hex 24`
   - `BLOB_READ_WRITE_TOKEN` — from a Vercel Blob store (only needed to test document uploads locally)
3. **Run migrations**: `npx prisma migrate dev`
4. **Seed default data** (app settings, 2026 contribution rates, one admin user): `npm run prisma:seed`
   - Creates `admin@ramulondi.local` / `ChangeMe123!` unless `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars are set. **Change this password immediately after first login.**
5. **Start the dev server**: `npm run dev`, then open http://localhost:3000

## Importing historical data

`scripts/import-xlsx.ts` imports members and multi-year (2024-2026) contribution history from the source workbook:

```bash
npm run import:xlsx -- "/path/to/RAMULONDI Payment Sheet.xlsx"
```

Notes:
- The workbook must never be committed to git (it's already gitignored via `*.xlsx`) — run this from a local copy.
- Most historical rows don't have a "Date Joined" value in the source sheet. Where missing, the import defaults it to 1 January of the earliest year that member appears in, and flags the member's `packageNote` field so admins know to verify it.
- Member ID numbers, phone numbers, and emails are **not** in the source sheet — these are collected from members via the mandatory profile-completion step after they activate their account (see "Account activation" below).
- The script is idempotent — re-running it won't duplicate existing payment allocations.
- It reconciles imported totals against each year's "Total" column in the source sheet and logs any mismatch greater than R1 for manual review.

## Account activation (no public signup)

Membership isn't self-service — an admin creates a `Member` record (new joiner or via import), then clicks "Generate activation link" on that member's admin detail page. The resulting one-time link is handed to the member offline (WhatsApp, SMS, in person) since this is a family society, not a public product. The member visits the link, sets a password (and confirms/fills their phone and email), and can then log in.

## Key business logic

- `src/lib/business/memberStatus.ts` — status/termination-date derivation (mirrors the spreadsheet's formula, with a fix for mid-year joiners). Runs after every payment/deceased-date write, and daily via `/api/cron/update-member-status` (see `vercel.json`).
- `src/lib/business/contributionAllocation.ts` — lump-sum payment apportionment across outstanding months/funds, and outstanding-balance calculation.
- `src/lib/business/claimEligibility.ts` — claim submission eligibility (cooling-off period, one-claim-per-member, not already lapsed at death) vs. payout authorization (blocked while any contribution balance is outstanding) — these are deliberately separate checks per the constitution.
- `src/lib/business/beneficiaryRules.ts` — enforces at most one Father/Mother beneficiary per member (also enforced at the DB level via a partial unique index — see migration `20260719150256_beneficiary_partial_unique_indexes`), and the 12-month beneficiary-deletion cooldown.
- `src/lib/validation/saId.ts` / `saPhone.ts` — South African ID number and phone number validation.
- Configurable rules (cooling-off period, joining fee, arrears thresholds, beneficiary-deletion window) live in the `AppSetting` table, editable at `/admin/settings` — no code change needed if the AGM changes a rule.

## Security notes

- RBAC is enforced twice: at the edge (`src/proxy.ts`, for fast redirects) and again in every server action/route via `src/server/permissions.ts` — never trust routing alone.
- Sensitive fields (ID numbers, banking details) are masked in the UI by default and never bulk-serialized. Full column-level encryption at rest was deliberately not built for v1 — see the security section of the original implementation plan for the reasoning; flagged as a future item if the society's risk profile changes.
- File uploads (ID proof, death certificates) are stored in a Vercel Blob store but are **never** exposed via a direct/public URL — all reads go through `/api/documents/[id]`, which checks ownership/role and streams the file server-side, logging every view to the audit log.
- Login lockout: 5 failed attempts locks the account for 15 minutes (see `src/lib/auth.ts`).
- All server actions re-validate input server-side with Zod, independent of client-side form validation.

## Deployment (Vercel + Neon)

1. **Provision Postgres**: create a [Neon](https://neon.tech) (or Supabase) project. Grab the pooled connection string (`DATABASE_URL`) and the direct/unpooled one (`DIRECT_URL`).
2. **Provision file storage**: create a [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store from your Vercel project's Storage tab; copy the `BLOB_READ_WRITE_TOKEN`.
3. **Import the project into Vercel** (from GitHub, or `vercel` CLI).
4. **Set environment variables** in the Vercel project (Production + Preview): `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your production URL), `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`.
5. Vercel will run `npm run vercel-build` (`prisma generate && prisma migrate deploy && next build`) automatically — migrations apply on every deploy.
6. `vercel.json` already schedules the daily status-refresh cron (`/api/cron/update-member-status`, 00:00 UTC). No extra setup needed once the project is deployed — Vercel Cron picks it up automatically on Pro plans; on the Hobby plan crons run once a day, which matches this job's cadence.
7. After the first deploy, run the seed script and/or the historical import **once**, pointed at the production `DIRECT_URL`, from a trusted local machine:
   ```bash
   DATABASE_URL="<prod pooled url>" DIRECT_URL="<prod direct url>" npm run prisma:seed
   DATABASE_URL="<prod pooled url>" DIRECT_URL="<prod direct url>" npm run import:xlsx -- "/path/to/workbook.xlsx"
   ```
8. Log in as the seeded admin, **change the password immediately**, then generate activation links for real members.

## Testing

```bash
npm run test        # Vitest unit tests for business logic
npx tsc --noEmit     # Type-check
npm run lint         # ESLint
```

Business logic (status derivation, lump-sum apportionment, SA ID/phone validation, claim eligibility) is unit-tested. The full member/admin/claims workflow was also verified end-to-end against a real database during development (member creation, validation rejection, Father/Mother beneficiary constraint, lump-sum apportionment, account activation, RBAC, claim submission, arrears-blocks-payout, and payout-after-settling) — see the implementation plan for the scenarios covered.
