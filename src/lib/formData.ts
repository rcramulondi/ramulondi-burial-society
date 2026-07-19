export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value === "") continue;
    if (key === "isDisabled") {
      obj[key] = value === "on" || value === "true";
      continue;
    }
    obj[key] = value;
  }
  return obj;
}
