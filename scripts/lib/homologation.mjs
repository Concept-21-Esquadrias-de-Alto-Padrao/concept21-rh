import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const config = JSON.parse(readFileSync(path.join(root, "config/homologation.json"), "utf8"));
export const privateDir = path.join(root, ".homologation");

export function assertHomologationTarget() {
  if (config.environment !== "homologation" || config.supabaseProjectRef !== "rcoqywqyjcxdzchojxzs" || config.supabaseProjectRef === config.productionSupabaseRef) {
    throw new Error("Destino de homologação não autorizado.");
  }
}

export function runCli(cli, args, options = {}) {
  let invocation = { command: "npx", args: ["--yes", cli, ...args] };
  if (process.platform === "win32") {
    const npx = spawnSync("where.exe", ["npx.cmd"], { encoding: "utf8" }).stdout?.trim().split(/\r?\n/)[0];
    const entry = npx && path.join(path.dirname(npx), "node_modules/npm/bin/npx-cli.js");
    if (!entry || !existsSync(entry)) throw new Error("Não foi possível localizar o executável Node do npx.");
    // Bypass cmd.exe so query strings and paths remain literal arguments.
    invocation = { command: process.execPath, args: [entry, "--yes", cli, ...args] };
  }
  const result = spawnSync(invocation.command, invocation.args, { cwd: root, encoding: "utf8", timeout: 180_000, ...options });
  if (result.error || result.status !== 0) {
    // Some commands return keys; never include their stdout in an error.
    throw new Error(`Falha em ${cli} ${args[0]}: ${result.error?.message || result.stderr || "comando recusado"}`);
  }
  return result.stdout;
}

export function parseCliJson(output) {
  const parsed = JSON.parse(output.trim());
  if (parsed._tag === "Error" || parsed.error) throw new Error("A operação remota foi recusada.");
  return parsed;
}

export function queryHomologation(sql) {
  assertHomologationTarget();
  const dir = mkdtempSync(path.join(privateDir, "sql-"));
  const file = path.join(dir, "query.sql");
  try {
    writeFileSync(file, sql, { mode: 0o600 });
    const result = parseCliJson(runCli("supabase@2.121.0", ["db", "query", "--linked", "--project-ref", config.supabaseProjectRef, "--file", file, "--output-format", "json"]));
    return Array.isArray(result) ? result : result.rows ?? result.data ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function bootstrapFiles() {
  const migrations = readdirSync(path.join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
  const seedAfter = new Map([
    [4, ["001_seed_hr_initial_data.sql", "002_update_portuguese_texts.sql"]],
    [8, ["003_daily_occurrence_report_config.sql"]],
    [10, ["004_seed_labor_costs.sql"]],
  ]);
  return migrations.flatMap((name) => [
    `supabase/migrations/${name}`,
    ...(seedAfter.get(Number(name.split("_")[0])) ?? []).map((seed) => `supabase/seeds/${seed}`),
  ]);
}

export function atomicBootstrapSql(sql, fileName, checksum) {
  const body = sql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "");
  return `begin;\n${body}\ninsert into app.homologation_bootstrap_files (file_name, checksum) values (${sqlLiteral(fileName)}, ${sqlLiteral(checksum)});\ncommit;`;
}

export function checksum(text) {
  return createHash("sha256").update(text).digest("hex");
}
