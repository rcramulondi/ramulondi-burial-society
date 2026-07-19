import { loadSettings, updateSettingForm } from "@/server/actions/settings";
import ActionForm from "@/components/forms/ActionForm";

const SETTING_LABELS: Record<string, string> = {
  COOLING_OFF_MONTHS: "Cooling-off period (months) before a new member can claim",
  JOINING_FEE_AMOUNT: "Joining fee (R)",
  ARREARS_LAPSE_MONTHS: "Consecutive months in arrears before a membership lapses",
  ARREARS_WARNING_MONTHS: "Consecutive months in arrears before showing \"about to lapse\"",
  BENEFICIARY_DELETION_WINDOW_MONTHS: "Minimum months between beneficiary deletions",
};

export default async function AdminSettingsPage() {
  const settings = await loadSettings();

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="text-sm text-neutral-500">
        These values can be changed by the AGM without needing a code change.
      </p>
      {Object.entries(settings).map(([key, value]) => (
        <ActionForm key={key} action={updateSettingForm} submitLabel="Save" className="flex flex-col gap-2 border rounded p-4">
          <input type="hidden" name="key" value={key} />
          <label className="flex flex-col gap-1 text-sm">
            {SETTING_LABELS[key] ?? key}
            <input name="value" type="number" defaultValue={value} className="border rounded px-3 py-2 bg-transparent" />
          </label>
        </ActionForm>
      ))}
    </div>
  );
}
