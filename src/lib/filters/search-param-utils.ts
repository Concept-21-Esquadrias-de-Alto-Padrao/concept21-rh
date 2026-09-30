export type SearchParamReader = Pick<URLSearchParams, "get">;

export type QueryParamPrimitive = string | number | boolean;
export type QueryParamValue = QueryParamPrimitive | string[] | null | undefined;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;

export function uniqueSearchParamValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function serializeArrayParam(values: string[]) {
  return uniqueSearchParamValues(values).join(",");
}

export function parseArrayParam(params: SearchParamReader, key: string) {
  const value = params.get(key);

  if (!value) {
    return [];
  }

  return uniqueSearchParamValues(value.split(","));
}

export function parseStringParam(params: SearchParamReader, key: string, defaultValue = "") {
  return params.get(key)?.trim() ?? defaultValue;
}

export function parseBooleanParam(
  params: SearchParamReader,
  key: string,
  defaultValue: boolean | null = null,
) {
  const value = params.get(key);

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return defaultValue;
}

export function parsePositiveIntegerParam(
  params: SearchParamReader,
  key: string,
  defaultValue = 1,
  options?: { min?: number; max?: number },
) {
  const value = Number(params.get(key));
  const min = options?.min ?? 1;
  const max = options?.max ?? Number.MAX_SAFE_INTEGER;

  if (!Number.isInteger(value)) {
    return defaultValue;
  }

  return Math.min(Math.max(value, min), max);
}

export function parseEnumParam<T extends string>(
  params: SearchParamReader,
  key: string,
  allowedValues: readonly T[],
  defaultValue: T,
) {
  const value = params.get(key);

  return allowedValues.includes(value as T) ? (value as T) : defaultValue;
}

export function parseDateParam(params: SearchParamReader, key: string, defaultValue = "") {
  const value = params.get(key);

  return value && isoDatePattern.test(value) ? value : defaultValue;
}

export function parseMonthParam(params: SearchParamReader, key: string, defaultValue = "") {
  const value = params.get(key);

  return value && monthPattern.test(value) ? value : defaultValue;
}

export function queryParamValueToString(value: QueryParamValue) {
  if (Array.isArray(value)) {
    const serialized = serializeArrayParam(value);
    return serialized || null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const serialized = String(value).trim();

  return serialized || null;
}
