import type { PostgrestError } from "@supabase/supabase-js";

import { SupabaseConfigError } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export class HrServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "HrServiceError";
  }
}

export function getHrSupabaseClient() {
  return getSupabaseBrowserClient();
}

export function mapSupabaseError(error: PostgrestError | Error | null) {
  if (!error) {
    return null;
  }

  if (error instanceof SupabaseConfigError) {
    return error;
  }

  return new HrServiceError(error.message, error);
}

export function assertNoError(error: PostgrestError | Error | null, fallback: string) {
  const mapped = mapSupabaseError(error);

  if (mapped) {
    throw new HrServiceError(fallback, mapped);
  }
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIsoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function slugifyKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
