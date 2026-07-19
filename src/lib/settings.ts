import { prisma } from "./prisma";

export const DEFAULT_SETTINGS = {
  COOLING_OFF_MONTHS: "6",
  JOINING_FEE_AMOUNT: "400",
  ARREARS_LAPSE_MONTHS: "6",
  ARREARS_WARNING_MONTHS: "3",
  BENEFICIARY_DELETION_WINDOW_MONTHS: "12",
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export async function getSetting(key: SettingKey): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  const raw = row?.value ?? DEFAULT_SETTINGS[key];
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`AppSetting "${key}" has a non-numeric value: "${raw}"`);
  }
  return value;
}

export async function getAllSettings(): Promise<Record<SettingKey, number>> {
  const keys = Object.keys(DEFAULT_SETTINGS) as SettingKey[];
  const values = await Promise.all(keys.map((key) => getSetting(key)));
  return Object.fromEntries(keys.map((key, i) => [key, values[i]])) as Record<
    SettingKey,
    number
  >;
}

export async function setSetting(
  key: SettingKey,
  value: string | number,
  updatedByUserId: string
): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: String(value), updatedByUserId },
    update: { value: String(value), updatedByUserId },
  });
}
