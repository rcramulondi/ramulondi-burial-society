import { listContributionRates, createContributionRateForm } from "@/server/actions/payment";
import { listClaimRates, createClaimRateForm } from "@/server/actions/claimRate";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import FieldLabel from "@/components/forms/FieldLabel";
import { formatDate, formatCurrency } from "@/lib/format";

const CLAIM_RATE_TYPE_LABELS: Record<string, string> = {
  BASE_PAYOUT: "Base claim payout",
  ADDITIONAL_BURIAL_SITE: "Additional burial-site payment (non-Khalavha)",
};

export default async function AdminRatesPage() {
  const [rates, claimRates] = await Promise.all([listContributionRates(), listClaimRates()]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Contribution rates</h1>
      <p className="text-sm text-neutral-500 max-w-lg">
        Adding a new rate for a type/fund automatically closes off the previous open-ended rate as
        of the new rate&apos;s effective date, so history is preserved and existing months keep using
        the rate that applied at the time.
      </p>

      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Type</th>
            <th className="py-1">Fund</th>
            <th className="py-1">Amount</th>
            <th className="py-1 hidden min-[480px]:table-cell">Effective from</th>
            <th className="py-1 hidden min-[480px]:table-cell">Effective to</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id} className="border-b border-black/5 dark:border-white/10">
              <td className="py-1">{r.membershipType}</td>
              <td className="py-1">{r.fund}</td>
              <td className="py-1">{formatCurrency(r.amount)}</td>
              <td className="py-1 hidden min-[480px]:table-cell">{formatDate(r.effectiveFrom)}</td>
              <td className="py-1 hidden min-[480px]:table-cell">{r.effectiveTo ? formatDate(r.effectiveTo) : "current"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <section className="max-w-sm">
        <h2 className="font-medium mb-2">Add a new rate</h2>
        <ActionForm action={createContributionRateForm} submitLabel="Save rate">
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Membership type" required />
            <select name="membershipType" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="MAIN">Main</option>
              <option value="KHADZI">Khadzi</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Fund" required />
            <select name="fund" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="BURIAL">Burial</option>
              <option value="FOOD">Food</option>
            </select>
          </label>
          <Field label="Monthly amount (R)" name="amount" type="number" required />
          <Field
            label="Effective from"
            name="effectiveFrom"
            type="date"
            required
            helperText="The previous open-ended rate for this type/fund is automatically closed off as of this date."
          />
        </ActionForm>
      </section>

      <hr className="border-black/10 dark:border-white/10" />

      <h1 className="text-xl font-semibold">Claim rates</h1>
      <p className="text-sm text-neutral-500 max-w-lg">
        The base payout and the additional burial-site payment (for burials not at Khalavha) are
        maintained annually here, the same way contribution rates are — adding a new rate closes off
        the previous one as of its effective date.
      </p>

      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Type</th>
            <th className="py-1">Amount</th>
            <th className="py-1 hidden min-[480px]:table-cell">Effective from</th>
            <th className="py-1 hidden min-[480px]:table-cell">Effective to</th>
          </tr>
        </thead>
        <tbody>
          {claimRates.map((r) => (
            <tr key={r.id} className="border-b border-black/5 dark:border-white/10">
              <td className="py-1">{CLAIM_RATE_TYPE_LABELS[r.type] ?? r.type}</td>
              <td className="py-1">{formatCurrency(r.amount)}</td>
              <td className="py-1 hidden min-[480px]:table-cell">{formatDate(r.effectiveFrom)}</td>
              <td className="py-1 hidden min-[480px]:table-cell">{r.effectiveTo ? formatDate(r.effectiveTo) : "current"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <section className="max-w-sm">
        <h2 className="font-medium mb-2">Add a new claim rate</h2>
        <ActionForm action={createClaimRateForm} submitLabel="Save rate">
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Type" required />
            <select name="type" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="BASE_PAYOUT">Base claim payout</option>
              <option value="ADDITIONAL_BURIAL_SITE">Additional burial-site payment</option>
            </select>
          </label>
          <Field label="Amount (R)" name="amount" type="number" required />
          <Field label="Effective from" name="effectiveFrom" type="date" required />
        </ActionForm>
      </section>
    </div>
  );
}
