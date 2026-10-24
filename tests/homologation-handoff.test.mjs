import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertNoEnvFiles, assertVercelProject, classifyVercelFailure, normalizeSource, preparationFailureMessage, projectId, teamId, validateLocalEnvironment, VercelPreparationError, verifyPublishedEnvironment } from "../scripts/lib/homologation-handoff.mjs";

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

function remoteFixture() {
  const remote = { ...env, NEXT_PUBLIC_APP_URL: "https://concept21-rh-homologacao.vercel.app" };
  return (endpoint) => {
    if (endpoint.startsWith("/v9/")) return { id: projectId, name: "concept21-rh-homologacao", accountId: teamId };
    if (endpoint.startsWith("/v10/")) return { envs: Object.keys(remote).map((key, id) => ({ key, id: String(id), target: ["production"] })) };
    const key = Object.keys(remote)[Number(endpoint.split("/").at(-1))];
    return { key, value: remote[key] };
  };
}

test("preparation reports seven bounded reads without requesting an administrative key", () => {
  const progress = [];
  const calls = [];
  const fixture = remoteFixture();
  const result = verifyPublishedEnvironment({ api: (endpoint, options) => { calls.push({ endpoint, options }); return fixture(endpoint); }, onProgress: (message) => progress.push(message), now: () => 0 });
  assert.equal(calls.length, 7);
  assert.equal(progress.length, 7);
  assert.ok(calls.every(({ options }) => options.timeout === 30_000));
  assert.ok(calls.every(({ endpoint }) => !endpoint.includes("SERVICE_ROLE")));
  assert.equal(Object.keys(result.env).length, 5);
  assert.ok(!progress.join(" ").includes(env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
});

test("preparation stops at the global deadline before another network call", () => {
  let clock = 0;
  let calls = 0;
  const fixture = remoteFixture();
  assert.throws(() => verifyPublishedEnvironment({ now: () => clock, totalTimeoutMs: 20, api: (endpoint, options) => { calls += 1; assert.equal(options.timeout, 20); clock = 21; return fixture(endpoint); } }), (error) => error.code === "TIMEOUT" && error.step === 2);
  assert.equal(calls, 1);
});

test("project read permission does not mask a denied variable query", () => {
  const fixture = remoteFixture();
  assert.throws(() => verifyPublishedEnvironment({ api: (endpoint) => { if (endpoint.startsWith("/v10/")) throw new Error("HTTP 403 Forbidden private-response"); return fixture(endpoint); } }), (error) => {
    const message = preparationFailureMessage(error);
    assert.equal(error.code, "PERMISSION_DENIED");
    assert.match(message, /etapa 2\/7/);
    assert.match(message, /Ler o projeto não garante acesso às variáveis/);
    assert.ok(!message.includes("private-response"));
    return true;
  });
});

test("safe diagnostics distinguish login, timeout and rate limits without raw errors", () => {
  for (const [raw, code] of [["401 unauthenticated secret-value", "LOGIN_REQUIRED"], ["ETIMEDOUT secret-value", "TIMEOUT"], ["429 rate limit secret-value", "RATE_LIMIT"]]) {
    assert.equal(classifyVercelFailure(new Error(raw)), code);
    assert.ok(!preparationFailureMessage(new VercelPreparationError(code, 1)).includes("secret-value"));
  }
  assert.ok(!preparationFailureMessage(new Error("secret-value")).includes("secret-value"));
});
