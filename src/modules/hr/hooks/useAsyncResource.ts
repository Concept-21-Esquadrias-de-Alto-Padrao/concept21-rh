"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

export interface AsyncResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const asyncResourceCache = new Map<string, unknown>();

function getCacheKey(dependencyKey: string | number | boolean) {
  return typeof dependencyKey === "string" && dependencyKey.length > 0 ? dependencyKey : null;
}

function getCachedData<T>(dependencyKey: string | number | boolean) {
  const cacheKey = getCacheKey(dependencyKey);

  if (!cacheKey || !asyncResourceCache.has(cacheKey)) {
    return null;
  }

  return asyncResourceCache.get(cacheKey) as T;
}

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  dependencyKey: string | number | boolean = "",
): AsyncResourceState<T> {
  const initialData = getCachedData<T>(dependencyKey);
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  const cacheKeyRef = useRef(getCacheKey(dependencyKey));

  useEffect(() => {
    loaderRef.current = loader;
    cacheKeyRef.current = getCacheKey(dependencyKey);
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextData = await loaderRef.current();
      const cacheKey = cacheKeyRef.current;

      if (cacheKey) {
        asyncResourceCache.set(cacheKey, nextData);
      }

      setData(nextData);
    } catch (resourceError) {
      setError(toUserFriendlyErrorMessage(resourceError, "Não foi possível carregar os dados."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const cacheKey = getCacheKey(dependencyKey);
      const cachedData = getCachedData<T>(dependencyKey);

      if (cachedData) {
        setData(cachedData);
      }

      setLoading(!cachedData);
      setError(null);

      try {
        const nextData = await loaderRef.current();

        if (active) {
          if (cacheKey) {
            asyncResourceCache.set(cacheKey, nextData);
          }

          setData(nextData);
        }
      } catch (resourceError) {
        if (active) {
          setError(toUserFriendlyErrorMessage(resourceError, "Não foi possível carregar os dados."));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [dependencyKey]);

  return { data, loading, error, reload };
}
