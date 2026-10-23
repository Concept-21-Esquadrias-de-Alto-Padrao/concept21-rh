import assert from "node:assert/strict";
import { test } from "node:test";
import { createMonthlyOccurrenceReportPdf } from "../src/modules/hr/services/monthly-occurrence-report-pdf.ts";

export function fixture({ longFilters = false, longSummary = false, count = 1 } = {}) {
  return {
    competence: "2026-10", competenceLabel: "10/2026",
    startDate: "2026-10-01", endDate: "2026-10-31", generatedAt: "2026-10-23",
    filters: {
      departmentName: "Departamento ficticio",
      employeeName: longFilters ? Array.from({ length: 70 }, (_, i) => `COLAB-QA-${i} Nome ficticio (HOM-${i})`).join(", ") : "IDENTITY-QA",
      occurrenceTypeName: "Feedback", onlyPayrollRelevant: false,
    },
    summary: { occurrenceCount: count, employeeCount: 1, departmentCount: 1, impactDays: 0, absenceCount: 0, delayCount: 0, medicalCertificateCount: 0 },
    departmentSummaries: [{ departmentName: "Departamento ficticio", employeeCount: 1, occurrenceCount: count, impactDays: 0, absenceCount: 0, delayCount: 0, medicalCertificateCount: 0 }],
    rows: Array.from({ length: count }, (_, i) => ({
      employeeName: "IDENTITY-QA", employeeNumber: "WORK-QA", departmentName: "Departamento ficticio",
      typeName: "Feedback", title: `TESTE PDF ${i}`, periodLabel: "23/10/2026", statusLabel: "Aberta", impactDays: 0,
      justification: longSummary ? Array.from({ length: 100 }, (_, n) => `fixtureline ${n}: texto ficticio para conferir paginacao e integridade.`).join("\n") : `fixtureline registro ${i}`,
    })),
  };
}

test("monthly PDF preserves long filter and summary text with identity on continuation pages", async () => {
  const report = fixture({ longFilters: true, longSummary: true });
  const before = structuredClone(report);
  const doc = await createMonthlyOccurrenceReportPdf(report);
  const pages = doc.internal.pages.slice(1).map((page) => page.join("\n"));
  assert.ok(pages.length > 2);
  assert.ok(pages.join("\n").includes("COLAB-QA-69"));
  assert.ok(pages.join("\n").includes("fixtureline 99"));
  for (const page of pages.filter((text) => text.includes("fixtureline"))) {
    assert.ok(page.includes("IDENTITY-QA"), "Every page containing a summary must identify the employee");
    assert.ok(page.includes("WORK-QA"));
  }
  assert.deepEqual(report, before, "Rendering must not change business totals or source rows");
});

test("monthly PDF handles empty data and many distinct rows", async () => {
  const empty = fixture({ count: 0 });
  empty.departmentSummaries = [];
  const emptyDoc = await createMonthlyOccurrenceReportPdf(empty);
  assert.equal(emptyDoc.getNumberOfPages(), 1);
  const doc = await createMonthlyOccurrenceReportPdf(fixture({ count: 100 }));
  const pages = doc.internal.pages.slice(1).map((page) => page.join("\n"));
  assert.ok(pages.length > 1);
  assert.ok(pages.join("\n").includes("fixtureline registro 99"));
  assert.ok(pages.every((page) => page.includes("IDENTITY-QA")));
});

test("filters can span several pages without losing the last selection or report data", async () => {
  const report = fixture();
  report.filters.employeeName = Array.from({ length: 1200 }, (_, n) => `FILTER-${String(n).padStart(4, "0")} Nome extenso para pesquisa`).join(", ");
  const doc = await createMonthlyOccurrenceReportPdf(report);
  const pages = doc.internal.pages.slice(1).map((page) => page.join("\n"));
  assert.ok(pages.length > 3);
  assert.ok(pages.join("\n").includes("FILTER-1199"));
  assert.ok(pages.at(-1).includes("fixtureline registro 0"));
  assert.ok(pages.every((page) => page.includes("Concept21 Aluminium")));
});

test("long names, Portuguese accents and unbroken text survive PDF rendering", async () => {
  const report = fixture();
  report.rows[0].employeeName = "João Gonçalves — TESTE ".repeat(7).replaceAll("—", "-");
  report.rows[0].justification = "Ação, férias, avaliação e justificativa. " + "ABCD".repeat(300) + " END-OF-SUMMARY";
  const doc = await createMonthlyOccurrenceReportPdf(report);
  const contents = doc.internal.pages.slice(1).map((page) => page.join("\n")).join("\n");
  assert.ok(contents.includes("João"));
  assert.ok(contents.includes("END-OF-SUMMARY"));
  assert.equal(report.summary.occurrenceCount, 1);
});
