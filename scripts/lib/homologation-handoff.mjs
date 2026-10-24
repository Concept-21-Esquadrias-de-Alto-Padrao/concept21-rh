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

export class VercelPreparationError extends Error {
  constructor(code, step) {
    super("Não foi possível conferir a configuração da homologação.");
    this.code = code;
    this.step = step;
  }
}

export function classifyVercelFailure(error) {
  const message = String(error?.message ?? "");
  if (/\b403\b|forbidden|insufficient permission|not authorized to access/i.test(message)) return "PERMISSION_DENIED";
  if (/\b401\b|unauthenticated|not logged in|no existing credentials|please (?:run|log in)/i.test(message)) return "LOGIN_REQUIRED";
  if (/ETIMEDOUT|timed? out|timeout/i.test(message)) return "TIMEOUT";
  if (/\b429\b|rate.?limit/i.test(message)) return "RATE_LIMIT";
  return "UNAVAILABLE";
}

export function preparationFailureMessage(error) {
  const messages = {
    PERMISSION_DENIED: "A conta Vercel não tem permissão para esta consulta. Ler o projeto não garante acesso às variáveis. Peça ao responsável a configuração local por canal seguro; não solicite acesso à produção.",
    LOGIN_REQUIRED: "A CLI precisa de login. Execute npx --yes vercel@50.28.0 login com sua conta nominal e tente novamente.",
    TIMEOUT: "O limite de espera foi atingido. Confira a conexão e se npx --yes vercel@50.28.0 --version conclui; depois repita o preparo.",
    RATE_LIMIT: "O Vercel limitou temporariamente as consultas. Aguarde alguns minutos e tente novamente.",
    INVALID_RESPONSE: "A configuração remota não está completa no formato esperado. Peça ao responsável para conferir a homologação.",
  };
  const code = error instanceof VercelPreparationError ? error.code : "UNAVAILABLE";
  const step = error instanceof VercelPreparationError && Number.isInteger(error.step) && error.step >= 1 && error.step <= 7 ? ` na etapa ${error.step}/7` : "";
  return `Preparo interrompido${step}. ${messages[code] ?? "Confira a instalação da CLI e o acesso à homologação com o responsável."} Nenhum valor de variável foi exibido.`;
}

export function vercelApi(endpoint, { timeout = 30_000 } = {}) {
  try {
    const payload = JSON.parse(runCli("vercel@50.28.0", ["api", `${endpoint}${endpoint.includes("?") ? "&" : "?"}teamId=${teamId}`, "--raw", "--non-interactive", "--scope", config.vercelTeam], { timeout, windowsHide: true }));
    if (payload.error || payload._tag === "Error") throw new Error(JSON.stringify(payload.error ?? payload));
    return payload;
  } catch (error) {
    throw new VercelPreparationError(classifyVercelFailure(error));
  }
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

export function verifyPublishedEnvironment({ api = vercelApi, onProgress = () => {}, now = Date.now, totalTimeoutMs = 120_000 } = {}) {
  const deadline = now() + totalTimeoutMs;
  let step = 0;
  function request(endpoint, label) {
    step += 1;
    onProgress(`Etapa ${step}/7: ${label}.`);
    const remaining = deadline - now();
    if (remaining <= 0) throw new VercelPreparationError("TIMEOUT", step);
    try {
      return api(endpoint, { timeout: Math.min(30_000, remaining) });
    } catch (error) {
      throw new VercelPreparationError(error instanceof VercelPreparationError ? error.code : classifyVercelFailure(error), step);
    }
  }
  const project = request(`/v9/projects/${projectId}`, "confirmando o projeto de homologação");
  assertVercelProject(project);
  const listing = request(`/v10/projects/${projectId}/env`, "conferindo os nomes das variáveis");
  if (!Array.isArray(listing.envs)) throw new VercelPreparationError("INVALID_RESPONSE", step);
  if (listing.envs.some((item) => ["RESEND_API_KEY", "ACCESS_REQUEST_FROM_EMAIL"].includes(item.key))) throw new Error("Remova a configuração de envio externo da homologação antes de publicar.");
  const env = {};
  for (const key of localKeys) {
    const candidates = listing.envs.filter((item) => item.key === key && item.target?.includes("production") && !item.gitBranch);
    if (candidates.length !== 1) throw new Error(`Configuração remota ausente ou ambígua: ${key}.`);
    const item = request(`/v1/projects/${projectId}/env/${candidates[0].id}`, `consultando ${key}, sem exibir seu valor`);
    if (item.key !== key || typeof item.value !== "string") throw new Error(`Não foi possível ler a configuração pública ${key}.`);
    env[key] = item.value;
  }
  if (env.NEXT_PUBLIC_APP_URL !== config.appUrl) throw new Error("A URL publicada não é a URL da homologação.");
  validateLocalEnvironment({ ...env, NEXT_PUBLIC_APP_URL: "http://localhost:3000" });
  return { project, env };
}
