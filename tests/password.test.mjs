import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordUpdateErrorMessage, validateNewPassword } from "../src/modules/hr/utils/password.ts";

test("password policy rejects short, oversized and mismatched inputs", () => {
  assert.match(validateNewPassword("short", "short"), /12 caracteres/);
  assert.match(validateNewPassword("x".repeat(129), "x".repeat(129)), /128 caracteres/);
  assert.match(validateNewPassword("x".repeat(12), "y".repeat(12)), /não coincidem/);
  assert.equal(validateNewPassword("x".repeat(12), "x".repeat(12)), null);
  assert.equal(validateNewPassword("x".repeat(128), "x".repeat(128)), null);
});

test("password policy preserves the exact password including spaces", () => {
  assert.match(validateNewPassword(" ".repeat(12), " ".repeat(12)), /apenas por espaços/);
  assert.equal(validateNewPassword("uma frase de teste", "uma frase de teste"), null);
  assert.match(validateNewPassword("uma frase de teste ", "uma frase de teste"), /não coincidem/);
});

test("password errors explain the remedy without leaking technical details", () => {
  assert.match(passwordUpdateErrorMessage({ code: "same_password" }), /diferente/);
  assert.match(passwordUpdateErrorMessage({ code: "weak_password" }), /mais forte/);
  assert.match(passwordUpdateErrorMessage({ code: "reauthentication_needed" }), /novo link/);
  assert.match(passwordUpdateErrorMessage({ code: "over_request_rate_limit" }), /Aguarde/);
  assert.match(passwordUpdateErrorMessage({ message: "Failed to fetch" }), /internet/);
  const message = passwordUpdateErrorMessage({ message: "internal SQL auth.users secret failure" });
  assert.ok(!message.includes("SQL"));
  assert.match(message, /responsável/);
});
