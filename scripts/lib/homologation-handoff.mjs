import { readdirSync } from "node:fs";
import { config, assertHomologationTarget, root, runCli } from "./homologation.mjs";

export const teamId = "team_CQgXB4kvuQBOXiv4siUoGnUe";
export const projectId = "prj_7WWMGTE7cuoJjCoF4Z2rp9YvKynv";
export const localKeys = ["NEXT_PUBLIC_APP_ENV", "NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_APP_URL"];

export function normalizeSource(file, raw) {
  return /\.(?:tsx?|mts|cts|mjs|json|css|svg)$/.test(file) || file === ".vercelignore"
    ? Buffer.from(raw.toString("utf8").replaceAll("\r\n", "\n"))
    : raw;
}

export function vercelApi(endpoint) {
  return JSON.parse(runCli("vercel@50.28.0", ["api", `${endpoint}${endpoint.includes("?") ? "&" : "?"}teamId=${teamId}`, "--raw", "--scope", config.vercelTeam]));
}

export function assertVercelProject(project) {
  assertHomologationTarget();
  if (project.id !== projectId || project.name !== config.vercelProjectName || project.accountId !== teamId) {
    throw new Error("Projeto Vercel recusado: use somente a homologação do RH.");
  }
}

export function validateLocalEnvironment(env) {
  assertHomologationTarget();
  if (Object.keys(env).some((key) => !localKeys.includes(key))) throw new Error("A configuração local aceita somente as cinco variáveis públicas do modelo.");
  if (env.NEXT_PUBLIC_APP_ENV !== "homologation" || env.NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF !== config.supabaseProjectRef || env.NEXT_PUBLIC_SUPABASE_URL !== `https://${config.supabaseProjectRef}.supabase.co`) {
    throw new Error("Configuração local recusada: banco ou ambiente diferente da homologação.");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")) throw new Error("Informe apenas a chave publishable da homologação; nunca use uma chave administrativa.");
  const url = new URL(env.NEXT_PUBLIC_APP_URL);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("A URL local deve ser http://localhost:PORTA, sem caminho ou credenciais.");
  }
  return env;
}

export function assertNoEnvFiles(directory = root) {
  if (readdirSync(directory).some((name) => name.startsWith(".env"))) throw new Error("Há arquivos .env nesta cópia. Use um clone exclusivo de testes, sem .env da produção.");
}

export function verifyPublishedEnvironment() {
  const project = vercelApi(`/v9/projects/${projectId}`);
  assertVercelProject(project);
  const listing = vercelApi(`/v10/projects/${projectId}/env`);
  if (listing.envs.some((item) => ["RESEND_API_KEY", "ACCESS_REQUEST_FROM_EMAIL"].includes(item.key))) throw new Error("Remova a configuração de envio externo da homologação antes de publicar.");
  const env = {};
  for (const key of localKeys) {
    const candidates = listing.envs.filter((item) => item.key === key && item.target?.includes("production") && !item.gitBranch);
    if (candidates.length !== 1) throw new Error(`Configuração remota ausente ou ambígua: ${key}.`);
    const item = vercelApi(`/v1/projects/${projectId}/env/${candidates[0].id}`);
    if (item.key !== key || typeof item.value !== "string") throw new Error(`Não foi possível ler a configuração pública ${key}.`);
    env[key] = item.value;
  }
  if (env.NEXT_PUBLIC_APP_URL !== config.appUrl) throw new Error("A URL publicada não é a URL da homologação.");
  validateLocalEnvironment({ ...env, NEXT_PUBLIC_APP_URL: "http://localhost:3000" });
  return { project, env };
}
