import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { assertSupabasePublicConfig } from "@/lib/supabase/config";

class SupabaseAdminConfigError extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY nao configurado no ambiente server-side.");
    this.name = "SupabaseAdminConfigError";
  }
}

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  if (!adminClient) {
    const config = assertSupabasePublicConfig();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      throw new SupabaseAdminConfigError();
    }

    adminClient = createClient(config.url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
