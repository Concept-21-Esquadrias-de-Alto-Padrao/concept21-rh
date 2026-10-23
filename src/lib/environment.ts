import { validateDeploymentEnvironment } from "./deployment-environment.mjs";

export function getDeploymentEnvironment() {
  return validateDeploymentEnvironment({
    environment: process.env.NEXT_PUBLIC_APP_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    expectedTestRef: process.env.NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF,
  });
}
