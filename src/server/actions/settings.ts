"use server";

import { requireAdmin } from "@/server/permissions";
import { getAllSettings, setSetting, DEFAULT_SETTINGS, type SettingKey } from "@/lib/settings";
import { revalidatePath } from "next/cache";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";

export async function loadSettings() {
  await requireAdmin();
  return getAllSettings();
}

export async function updateSetting(key: string, value: number): Promise<ActionResult<{ key: string }>> {
  try {
    const session = await requireAdmin();
    if (!(key in DEFAULT_SETTINGS)) return { ok: false, error: "Unknown setting." };
    if (!Number.isFinite(value) || value < 0) return { ok: false, error: "Value must be a non-negative number." };

    await setSetting(key as SettingKey, value, session.user.id);
    revalidatePath("/admin/settings");
    return { ok: true, data: { key } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to update setting.") };
  }
}

export async function updateSettingForm(formData: FormData) {
  return updateSetting(String(formData.get("key")), Number(formData.get("value")));
}
