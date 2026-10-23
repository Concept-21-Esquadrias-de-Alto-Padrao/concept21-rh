import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeMonthlyCostSnapshots } from "../src/modules/hr/utils/labor-cost-calculations.ts";

const row = (employee_id, status, total_company_cost, overrides = {}) => ({ employee_id, status, total_company_cost, reference_month: "2026-10-01", is_active: true, updated_at: "2026-10-21T17:00:00Z", calculated_at: "2026-10-21T17:00:00Z", ...overrides });
test("closed total respects employee filters, competence, cancellation and inactive snapshots", () => {
  const summary = summarizeMonthlyCostSnapshots([
    row("a", "closed", 1000), row("b", "closed", 2000),
    row("a", "closed", 3000, { reference_month: "2026-09-01" }),
    row("c", "closed", 4000, { is_active: false }), row("d", "cancelled", 5000),
  ], ["a", "c", "d"], "2026-10");
  assert.equal(summary.totalClosedCost, 1000);
  assert.equal(summary.closedCount, 1);
  assert.equal(summary.unpreparedCount, 2);
  assert.equal(summary.state, "partial");
});
test("complete versus partial versus estimated is based on selected population", () => {
  assert.equal(summarizeMonthlyCostSnapshots([row("a", "closed", 1000)], ["a"], "2026-10").state, "closed");
  assert.equal(summarizeMonthlyCostSnapshots([row("a", "estimated", 1000)], ["a"], "2026-10").state, "estimated");
  assert.equal(summarizeMonthlyCostSnapshots([], [], "2026-10").state, "estimated");
});
