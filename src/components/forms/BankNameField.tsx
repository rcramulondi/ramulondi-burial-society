"use client";

import { useState } from "react";

const TOP_BANKS = ["Standard Bank", "ABSA", "FNB", "Nedbank", "Capitec"];
const OTHER = "OTHER";

export default function BankNameField({ defaultValue }: { defaultValue?: string }) {
  const isKnownBank = defaultValue ? TOP_BANKS.includes(defaultValue) : true;
  const [selected, setSelected] = useState(isKnownBank ? (defaultValue ?? "") : OTHER);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        Bank name
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required={selected !== OTHER}
          className="border border-slate-300 rounded px-3 py-2 bg-white"
        >
          <option value="" disabled>Select a bank</option>
          {TOP_BANKS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
          <option value={OTHER}>Other</option>
        </select>
      </label>
      {selected === OTHER ? (
        <input
          name="bankName"
          type="text"
          required
          placeholder="Bank name"
          defaultValue={!isKnownBank ? defaultValue : ""}
          className="border border-slate-300 rounded px-3 py-2 bg-white"
        />
      ) : (
        <input type="hidden" name="bankName" value={selected} />
      )}
    </div>
  );
}
