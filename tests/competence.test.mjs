import assert from "node:assert/strict";
import { test } from "node:test";
import { formatReferenceMonthName, getMonthBounds, normalizeReferenceMonth } from "../src/modules/hr/utils/labor-cost-calculations.ts";

test("competence labels do not move to the previous month in Brazil", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["America/Sao_Paulo", "UTC", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      assert.equal(formatReferenceMonthName("2026-10"), "out");
      assert.equal(formatReferenceMonthName("2026-01-01"), "jan");
      assert.equal(formatReferenceMonthName("2026-12"), "dez");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
test("competence bounds match February and year boundaries", () => {
  assert.deepEqual(getMonthBounds("2028-02"), { startDate: "2028-02-01", endDate: "2028-02-29" });
  assert.deepEqual(getMonthBounds("2026-12"), { startDate: "2026-12-01", endDate: "2026-12-31" });
  for (const value of ["2026-00", "2026-13", "10/2026"]) assert.throws(() => normalizeReferenceMonth(value));
});
