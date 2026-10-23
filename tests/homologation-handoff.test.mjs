import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertNoEnvFiles, assertVercelProject, normalizeSource, projectId, teamId, validateLocalEnvironment } from "../scripts/lib/homologation-handoff.mjs";

const env = { NEXT_PUBLIC_APP_ENV: "homologation", NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF: "rcoqywqyjcxdzchojxzs", NEXT_PUBLIC_SUPABASE_URL: "https://rcoqywqyjcxdzchojxzs.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fake_test_only", NEXT_PUBLIC_APP_URL: "http://localhost:3000" };

test("baseline comparison handles Windows declaration files without changing binary assets", () => {
  assert.equal(normalizeSource("src/lib/environment.d.mts", Buffer.from("export {};\r\n")).toString(), "export {};\n");
  const binary = Buffer.from([0, 13, 10, 255]);
  assert.equal(normalizeSource("src/app/favicon.ico", binary), binary);
});

test("local runner accepts only the fixed test database and a public key", () => {
  assert.doesNotThrow(() => validateLocalEnvironment(env));
  for (const patch of [{ NEXT_PUBLIC_APP_ENV: "production" }, { NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF: "sdyjujqwgsxdrzfuyydm" }, { NEXT_PUBLIC_SUPABASE_URL: "https://sdyjujqwgsxdrzfuyydm.supabase.co" }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_fake" }, { SUPABASE_SERVICE_ROLE_KEY: "forbidden" }, { NEXT_PUBLIC_APP_URL: "https://concept21-rh.vercel.app" }]) {
    assert.throws(() => validateLocalEnvironment({ ...env, ...patch }));
  }
});

test("Vercel operations require the exact test project and team", () => {
  const project = { id: projectId, name: "concept21-rh-homologacao", accountId: teamId };
  assert.doesNotThrow(() => assertVercelProject(project));
  assert.throws(() => assertVercelProject({ ...project, id: "prj_FIuesZaxPSgLRkJ0Y1CNjIATMfsV" }));
  assert.throws(() => assertVercelProject({ ...project, accountId: "another-team" }));
});

test("local runner refuses dotenv files rather than loading another environment", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rh-env-test-"));
  try {
    assert.doesNotThrow(() => assertNoEnvFiles(dir));
    writeFileSync(path.join(dir, ".env.local"), "FAKE=1");
    assert.throws(() => assertNoEnvFiles(dir));
  } finally {
    rmSync(dir, { recursive: true });
  }
});
