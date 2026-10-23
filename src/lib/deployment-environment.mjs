export const PRODUCTION_SUPABASE_REF = "sdyjujqwgsxdrzfuyydm";

/** Validate the destination before creating any Supabase client. */
export function validateDeploymentEnvironment({ environment, supabaseUrl, expectedTestRef, vercelEnvironment } = {}) {
  const mode = environment || "production";
  if (!["production", "homologation"].includes(mode)) {
    throw new Error("Ambiente inválido. Configure production ou homologation.");
  }
  if (vercelEnvironment === "preview" && mode !== "homologation") {
    throw new Error("Um preview deve usar o ambiente de homologação.");
  }
  if (mode === "homologation") {
    if (!expectedTestRef || !/^[a-z]{20}$/.test(expectedTestRef) || expectedTestRef === PRODUCTION_SUPABASE_REF) {
      throw new Error("Configure a referência do banco exclusivo de homologação.");
    }
    if (supabaseUrl !== `https://${expectedTestRef}.supabase.co`) {
      throw new Error("Homologação bloqueada: o banco configurado não é o banco de testes autorizado.");
    }
  } else if (supabaseUrl && new URL(supabaseUrl).hostname !== `${PRODUCTION_SUPABASE_REF}.supabase.co`) {
    throw new Error("O ambiente de produção deve usar o banco de produção do RH.");
  }
  return { environment: mode, isHomologation: mode === "homologation" };
}

export function canSendExternalCommunications(environment) {
  return environment === "production";
}
