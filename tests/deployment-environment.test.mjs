import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCTION_SUPABASE_REF, validateDeploymentEnvironment, canSendExternalCommunications } from "../src/lib/deployment-environment.mjs";

const testRef = "abcdefghijklmnopqrst";
const testConfig = { environment: "homologation", supabaseUrl: `https://${testRef}.supabase.co`, expectedTestRef: testRef };

test("homologation accepts only the explicitly configured test database", () => {
  assert.equal(validateDeploymentEnvironment(testConfig).isHomologation, true);
  for (const supabaseUrl of [`https://${PRODUCTION_SUPABASE_REF}.supabase.co`, "https://another.supabase.co", undefined]) {
    assert.throws(() => validateDeploymentEnvironment({ ...testConfig, supabaseUrl }));
  }
});
test("homologation refuses missing, malformed and production project references", () => {
  for (const expectedTestRef of [undefined, "", "bad-ref", PRODUCTION_SUPABASE_REF]) {
    assert.throws(() => validateDeploymentEnvironment({ ...testConfig, expectedTestRef }));
  }
});
test("preview cannot inherit production configuration", () => {
  assert.throws(() => validateDeploymentEnvironment({ vercelEnvironment: "preview" }));
  assert.equal(validateDeploymentEnvironment({ ...testConfig, vercelEnvironment: "preview" }).isHomologation, true);
});
test("production refuses an accidentally configured test database", () => {
  assert.equal(validateDeploymentEnvironment({ supabaseUrl: `https://${PRODUCTION_SUPABASE_REF}.supabase.co` }).isHomologation, false);
  assert.throws(() => validateDeploymentEnvironment({ supabaseUrl: testConfig.supabaseUrl }));
  assert.throws(() => validateDeploymentEnvironment({ environment: "homologacao" }));
});
test("external communications fail closed for unknown and test environments", () => {
  assert.equal(canSendExternalCommunications("production"), true);
  for (const environment of ["homologation", undefined, "", "staging"]) {
    assert.equal(canSendExternalCommunications(environment), false);
  }
});
