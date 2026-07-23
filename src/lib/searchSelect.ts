export type SearchSelectOption = { value: string; label: string; searchText?: string };

export function filterOptions(options: SearchSelectOption[], query: string): SearchSelectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => (o.searchText ?? o.label).toLowerCase().includes(q));
}
