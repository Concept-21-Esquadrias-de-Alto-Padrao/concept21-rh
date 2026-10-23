import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { atomicBootstrapSql, bootstrapFiles, config, assertHomologationTarget } from "../scripts/lib/homologation.mjs";

test("bootstrap fixes an isolated project reference and never relies on the local production link", () => {
  assert.doesNotThrow(assertHomologationTarget);
  assert.notEqual(config.supabaseProjectRef, config.productionSupabaseRef);
  assert.match(config.name, /HOMOLOGACAO/);
  assert.match(config.appUrl, /rh-homologacao/);
});
test("base catalogs exist before dependent data migrations", () => {
  const files = bootstrapFiles();
  assert.equal(new Set(files).size, files.length);
  assert.equal(files.filter((f) => f.includes("/seeds/")).length, 4);
  assert.ok(files.findIndex((f) => f.endsWith("001_seed_hr_initial_data.sql")) < files.findIndex((f) => f.includes("008_daily")));
  assert.ok(files.findIndex((f) => f.endsWith("004_seed_labor_costs.sql")) < files.findIndex((f) => f.includes("011_make")));
});
test("each bootstrap file and its checksum commit in the same transaction", () => {
  const sql = atomicBootstrapSql("begin;\nselect 'test';\ncommit;", "test.sql", "abc");
  assert.equal((sql.match(/begin;/g) ?? []).length, 1);
  assert.equal((sql.match(/commit;/g) ?? []).length, 1);
  assert.ok(sql.indexOf("insert into app.homologation_bootstrap_files") < sql.indexOf("commit;"));
});

test("email suppression hook is staging-only, unprivileged and inaccessible to client roles", () => {
  const sql = readFileSync(new URL("../supabase/homologation/block-email.sql", import.meta.url), "utf8");
  assert.match(sql, /security invoker/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /from public, anon, authenticated/i);
  assert.match(sql, /HOMOLOGACAO_EMAIL_BLOCKED/);
  assert.ok(bootstrapFiles().every((file) => !file.includes("block-email")));
});
