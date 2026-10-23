import type { NextConfig } from "next";
import { validateDeploymentEnvironment } from "./src/lib/deployment-environment.mjs";

validateDeploymentEnvironment({
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  expectedTestRef: process.env.NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF,
  vercelEnvironment: process.env.VERCEL_ENV,
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
