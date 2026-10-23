import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { privateDir, root } from "./lib/homologation.mjs";
import { assertNoEnvFiles, validateLocalEnvironment } from "./lib/homologation-handoff.mjs";

try {
  const mode = process.argv[2] ?? "dev";
  if (!["check", "dev", "build", "start"].includes(mode)) throw new Error("Use check, dev, build ou start.");
  assertNoEnvFiles();
  const local = validateLocalEnvironment(JSON.parse(readFileSync(path.join(privateDir, "local-env.json"), "utf8")));
  console.log(`Destino exclusivo: ${local.NEXT_PUBLIC_SUPABASE_URL}; aplicação ${local.NEXT_PUBLIC_APP_URL}. Sem chave administrativa ou provedor de e-mail.`);
  if (mode !== "check") {
    const env = { ...process.env, ...local, NODE_ENV: mode === "dev" ? "development" : "production", SUPABASE_SERVICE_ROLE_KEY: "", RESEND_API_KEY: "", ACCESS_REQUEST_FROM_EMAIL: "", DATABASE_URL: "", SUPABASE_DB_URL: "", VERCEL_ENV: "" };
    const port = new URL(local.NEXT_PUBLIC_APP_URL).port || "80";
    const args = [path.join(root, "node_modules/next/dist/bin/next"), mode, ...(mode === "build" ? [] : ["--hostname", "127.0.0.1", "--port", port])];
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit" });
    child.on("error", () => { console.error("Não foi possível iniciar o Next.js. Execute npm ci com Node 24."); process.exitCode = 1; });
    child.on("exit", (code) => { process.exitCode = code ?? 1; });
  }
} catch (error) {
  console.error(error.code === "ENOENT" ? "Configuração local ausente. Consulte docs/entrega-homologacao-rh.md." : error.message);
  process.exitCode = 1;
}
