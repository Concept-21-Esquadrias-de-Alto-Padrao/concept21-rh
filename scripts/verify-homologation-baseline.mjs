import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { root } from "./lib/homologation.mjs";

try {
  const state = JSON.parse(readFileSync(path.join(root, "docs/homologation-state.json"), "utf8"));
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  for (const file of state.sourceVerification.files) {
    const raw = readFileSync(path.join(root, file.path));
    const content = /\.(?:tsx?|mjs|json|css|svg)$/.test(file.path) || file.path === ".vercelignore" ? Buffer.from(raw.toString("utf8").replaceAll("\r\n", "\n")) : raw;
    if (digest(content) !== file.gitBlobSha256) throw new Error(`Fonte diferente da base publicada: ${file.path}`);
  }
  for (const file of state.supabase.files) {
    const raw = readFileSync(path.join(root, file.file_name), "utf8");
    const lf = raw.replaceAll("\r\n", "\n");
    if (![raw, lf, lf.replaceAll("\n", "\r\n")].some((text) => digest(text) === file.checksum)) throw new Error(`SQL diferente da base aplicada: ${file.file_name}`);
  }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  console.log(`${state.sourceVerification.verifiedFileCount} fontes e ${state.supabase.files.length} arquivos SQL coincidem com a base. HEAD: ${commit}. Nenhuma conexão ou alteração de banco foi realizada.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
