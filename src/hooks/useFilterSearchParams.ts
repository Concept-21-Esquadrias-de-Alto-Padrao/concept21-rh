"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  parseArrayParam,
  parseBooleanParam,
  parseDateParam,
  parseEnumParam,
  parseMonthParam,
  parsePositiveIntegerParam,
  parseStringParam,
  queryParamValueToString,
  type QueryParamValue,
} from "@/lib/filters/search-param-utils";

interface SetSearchParamsOptions {
  defaults?: Record<string, QueryParamValue>;
  resetPage?: boolean;
  pageParam?: string;
  scroll?: boolean;
}

function getUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function valuesMatchDefault(value: string | null, defaultValue: QueryParamValue) {
  const serializedDefault = queryParamValueToString(defaultValue);

  return value === serializedDefault || (!value && !serializedDefault);
}

export function useFilterSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(searchParamsString), [searchParamsString]);

  const createHref = useCallback(
    (updates: Record<string, QueryParamValue>, options?: SetSearchParamsOptions) => {
      const nextParams = new URLSearchParams(searchParamsString);
      const defaults = options?.defaults ?? {};

      Object.entries(updates).forEach(([key, value]) => {
        const serialized = queryParamValueToString(value);

        if (serialized === null || valuesMatchDefault(serialized, defaults[key])) {
          nextParams.delete(key);
          return;
        }

        nextParams.set(key, serialized);
      });

      if (options?.resetPage) {
        nextParams.delete(options.pageParam ?? "page");
      }

      return getUrl(pathname, nextParams);
    },
    [pathname, searchParamsString],
  );

  const replaceParams = useCallback(
    (updates: Record<string, QueryParamValue>, options?: SetSearchParamsOptions) => {
      const href = createHref(updates, options);
      const currentHref = getUrl(pathname, params);

      if (href === currentHref) {
        return;
      }

      router.replace(href, { scroll: options?.scroll ?? false });
    },
    [createHref, params, pathname, router],
  );

  const clearParams = useCallback(
    (keys: string[], options?: { scroll?: boolean }) => {
      const nextParams = new URLSearchParams(searchParamsString);

      keys.forEach((key) => nextParams.delete(key));

      const href = getUrl(pathname, nextParams);
      const currentHref = getUrl(pathname, params);

      if (href !== currentHref) {
        router.replace(href, { scroll: options?.scroll ?? false });
      }
    },
    [params, pathname, router, searchParamsString],
  );

  const getArray = useCallback((key: string) => parseArrayParam(params, key), [params]);
  const getString = useCallback(
    (key: string, defaultValue = "") => parseStringParam(params, key, defaultValue),
    [params],
  );
  const getBoolean = useCallback(
    (key: string, defaultValue: boolean | null = null) => parseBooleanParam(params, key, defaultValue),
    [params],
  );
  const getDate = useCallback(
    (key: string, defaultValue = "") => parseDateParam(params, key, defaultValue),
    [params],
  );
  const getMonth = useCallback(
    (key: string, defaultValue = "") => parseMonthParam(params, key, defaultValue),
    [params],
  );
  const getNumber = useCallback(
    (key: string, defaultValue = 1, options?: { min?: number; max?: number }) =>
      parsePositiveIntegerParam(params, key, defaultValue, options),
    [params],
  );
  const getEnum = useCallback(
    <T extends string>(key: string, allowedValues: readonly T[], defaultValue: T) =>
      parseEnumParam(params, key, allowedValues, defaultValue),
    [params],
  );

  return useMemo(
    () => ({
      params,
      createHref,
      replaceParams,
      clearParams,
      getArray,
      getString,
      getBoolean,
      getDate,
      getMonth,
      getNumber,
      getEnum,
    }),
    [
      clearParams,
      createHref,
      getArray,
      getBoolean,
      getDate,
      getEnum,
      getMonth,
      getNumber,
      getString,
      params,
      replaceParams,
    ],
  );
}
