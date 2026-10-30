import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const rhProjectRef = "sdyjujqwgsxdrzfuyydm";

export class CorporateIdentityError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export type CorporateIdentityPilot = {
  identityId: string;
  displayName: string;
  approvedModules: string[];
  productionTechnicalPair: boolean;
};

export async function getMyCorporateIdentityPilot(): Promise<CorporateIdentityPilot> {
  const auth = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await auth.auth.getUser();

  if (userError || !user) {
    throw new CorporateIdentityError(401, "Entre no RH para consultar seus vínculos.");
  }
  if (!user.email_confirmed_at && !(user as typeof user & { confirmed_at?: string | null }).confirmed_at) {
    throw new CorporateIdentityError(403, "Confirme seu e-mail antes de consultar os vínculos.");
  }

  const admin = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) throw new CorporateIdentityError(500, "Falha ao validar o perfil.");
  if (!profile?.is_active) throw new CorporateIdentityError(403, "Perfil inativo ou ausente.");

  const { data: rhLink, error: linkError } = await admin
    .from("corporate_account_links")
    .select("corporate_identity_id")
    .eq("module_key", "rh")
    .eq("source_project_ref", rhProjectRef)
    .eq("source_profile_id", profile.id)
    .eq("source_auth_user_id", user.id)
    .maybeSingle();

  if (linkError) throw new CorporateIdentityError(500, "Falha ao consultar o vínculo.");
  if (!rhLink) throw new CorporateIdentityError(404, "Identidade ainda não vinculada ao RH.");

  const { data: identity, error: identityError } = await admin
    .from("corporate_identities")
    .select("id, display_name, status")
    .eq("id", rhLink.corporate_identity_id)
    .maybeSingle();

  if (identityError) throw new CorporateIdentityError(500, "Falha ao consultar a identidade.");
  if (identity?.status !== "active") throw new CorporateIdentityError(403, "Identidade inativa.");

  const { data: links, error: linksError } = await admin
    .from("corporate_account_links")
    .select("module_key")
    .eq("corporate_identity_id", identity.id)
    .eq("source_active_at_review", true);

  if (linksError) throw new CorporateIdentityError(500, "Falha ao consultar os módulos.");

  const approvedModules = [...new Set((links ?? []).map((link) => link.module_key))].sort();
  return {
    identityId: identity.id,
    displayName: identity.display_name,
    approvedModules,
    productionTechnicalPair: approvedModules.includes("production") && approvedModules.includes("technical"),
  };
}
