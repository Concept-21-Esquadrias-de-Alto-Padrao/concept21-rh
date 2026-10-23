import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { privateDir } from "./lib/homologation.mjs";
import { verifyPublishedEnvironment } from "./lib/homologation-handoff.mjs";

try {
  const { env } = verifyPublishedEnvironment();
  mkdirSync(privateDir, { recursive: true });
  writeFileSync(path.join(privateDir, "local-env.json"), JSON.stringify({ ...env, NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, null, 2), { mode: 0o600 });
  console.log("Configuração local de homologação preparada em .homologation/local-env.json. Nenhuma chave administrativa foi consultada ou copiada.");
} catch {
  console.error("Não foi possível preparar a configuração. Confirme seu login e acesso ao projeto Vercel concept21-rh-homologacao; consulte o guia de entrega. Valores não foram exibidos.");
  process.exitCode = 1;
}
