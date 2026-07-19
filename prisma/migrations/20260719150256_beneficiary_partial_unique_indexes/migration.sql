-- Enforces "at most one Father and one Mother beneficiary per member" at the
-- database level (source of truth under concurrent writes). The application
-- layer also checks this pre-emptively for a friendly error message — see
-- src/lib/business/beneficiaryRules.ts.
CREATE UNIQUE INDEX "uniq_father_per_member" ON "Beneficiary" ("memberId")
  WHERE "relationship" = 'FATHER' AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX "uniq_mother_per_member" ON "Beneficiary" ("memberId")
  WHERE "relationship" = 'MOTHER' AND "deletedAt" IS NULL;
