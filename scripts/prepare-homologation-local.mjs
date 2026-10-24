import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { privateDir } from "./lib/homologation.mjs";
import { preparationFailureMessage, verifyPublishedEnvironment } from "./lib/homologation-handoff.mjs";

try {
  console.log("Preparando somente a homologação: até 30 segundos por consulta e 120 segundos no total. Nenhum deployment ou SQL será executado.");
  const { env } = verifyPublishedEnvironment({ onProgress: (message) => console.log(message) });
  mkdirSync(privateDir, { recursive: true });
  writeFileSync(path.join(privateDir, "local-env.json"), JSON.stringify({ ...env, NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, null, 2), { mode: 0o600 });
  console.log("Configuração local de homologação preparada em .homologation/local-env.json. Nenhuma chave administrativa foi consultada ou copiada.");
} catch (error) {
  console.error(preparationFailureMessage(error));
  process.exitCode = 1;
}
