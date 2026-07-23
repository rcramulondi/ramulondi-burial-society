import { describe, it, expect } from "vitest";
import { filterOptions } from "../searchSelect";

const options = [
  { value: "1", label: "Reggy Demana" },
  { value: "2", label: "Mavhonani Demana" },
  { value: "3", label: "Lufuno Nephali", searchText: "Lufuno Nephali RAMU0099" },
];

describe("filterOptions", () => {
  it("returns all options when the query is empty", () => {
    expect(filterOptions(options, "")).toEqual(options);
    expect(filterOptions(options, "   ")).toEqual(options);
  });

  it("filters case-insensitively against the label", () => {
    expect(filterOptions(options, "demana")).toHaveLength(2);
    expect(filterOptions(options, "REGGY")).toEqual([options[0]]);
  });

  it("prefers searchText over label when both are present", () => {
    expect(filterOptions(options, "RAMU0099")).toEqual([options[2]]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterOptions(options, "nonexistent")).toEqual([]);
  });
});
