import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { assertSupabasePublicConfig } from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const config = assertSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies. Route handlers and
          // server actions can, so this client stays safe across both contexts.
        }
      },
    },
  });
}
