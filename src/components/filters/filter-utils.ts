export function uniqueFilterValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function removeFilterValue(values: string[], value: string) {
  return values.filter((currentValue) => currentValue !== value);
}

export function toggleFilterValue(values: string[], value: string) {
  return values.includes(value)
    ? removeFilterValue(values, value)
    : uniqueFilterValues([...values, value]);
}

export function matchesAnyFilterValue(value: string | null | undefined, values: string[]) {
  return values.length === 0 || Boolean(value && values.includes(value));
}

