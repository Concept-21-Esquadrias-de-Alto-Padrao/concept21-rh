import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertSupabasePublicConfig } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const config = assertSupabasePublicConfig();
    browserClient = createBrowserClient(config.url, config.anonKey);
  }

  return browserClient;
}

export function createSupabaseCallbackBrowserClient() {
  const config = assertSupabasePublicConfig();

  return createBrowserClient(config.url, config.anonKey, {
    auth: {
      detectSessionInUrl: false,
    },
    isSingleton: false,
  });
}
