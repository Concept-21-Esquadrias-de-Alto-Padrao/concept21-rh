import assert from "node:assert/strict";
import test from "node:test";
import { isReviewedPilotAdmin } from "../src/lib/corporate-pilot-admin.ts";

const primary = "11111111-2222-4333-8444-555555555555";
const recovery = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("only explicitly reviewed pilot administrators reach the live RH Master check", () => {
  assert.equal(isReviewedPilotAdmin(primary, primary, undefined), true);
  assert.equal(isReviewedPilotAdmin(recovery, primary, recovery), true);
  assert.equal(isReviewedPilotAdmin(recovery, primary, undefined), false);
  assert.equal(isReviewedPilotAdmin("99999999-8888-4777-8666-555555555555", primary, recovery), false);
  assert.equal(isReviewedPilotAdmin("invalid", primary, recovery), false);
  assert.equal(isReviewedPilotAdmin(recovery, primary, "invalid"), false);
});
