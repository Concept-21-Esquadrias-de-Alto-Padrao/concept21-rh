export const PRODUCTION_SUPABASE_REF: string;
export function validateDeploymentEnvironment(config?: {
  environment?: string;
  supabaseUrl?: string;
  expectedTestRef?: string;
  vercelEnvironment?: string;
}): { environment: "production" | "homologation"; isHomologation: boolean };
export function canSendExternalCommunications(environment?: string): boolean;
