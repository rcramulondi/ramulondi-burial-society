import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding default app settings...");
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value, description: "Default seeded value" },
      update: {},
    });
  }

  console.log("Seeding 2026 contribution rates (from the source spreadsheet)...");
  const jan1 = new Date(Date.UTC(2026, 0, 1));
  const rates: { membershipType: "MAIN" | "KHADZI"; fund: "BURIAL" | "FOOD"; amount: number }[] = [
    { membershipType: "MAIN", fund: "BURIAL", amount: 70 },
    { membershipType: "MAIN", fund: "FOOD", amount: 10 },
    { membershipType: "KHADZI", fund: "BURIAL", amount: 35 },
    { membershipType: "KHADZI", fund: "FOOD", amount: 5 },
  ];
  for (const rate of rates) {
    await prisma.contributionRate.upsert({
      where: {
        membershipType_fund_effectiveFrom: {
          membershipType: rate.membershipType,
          fund: rate.fund,
          effectiveFrom: jan1,
        },
      },
      create: { ...rate, effectiveFrom: jan1 },
      update: { amount: rate.amount },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@ramulondi.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  console.log(`Seeding admin user (${adminEmail})...`);
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, passwordHash, role: "ADMIN", mustChangePassword: true },
    update: {},
  });

  console.log("Seed complete.");
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`(Using default admin password "${adminPassword}" — change it immediately after first login.)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
