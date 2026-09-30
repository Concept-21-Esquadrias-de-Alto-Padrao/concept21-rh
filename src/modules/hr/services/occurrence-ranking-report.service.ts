import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";

import { createAuditLog } from "@/modules/hr/services/audit.service";
import type { JsonValue } from "@/modules/hr/types";
import { formatDateTime } from "@/modules/hr/utils/format";

export interface OccurrenceRankingPdfRow {
  rank: number;
  employeeName: string;
  employeeNumber?: string | null;
  departmentName: string;
  employeeStatusName: string;
  occurrenceCount: number;
  typeSummary: string;
  lastOccurrenceAt?: string | null;
  percentage: number;
}

export interface OccurrenceRankingPdfReport {
  generatedAt: string;
  periodLabel: string;
  filters: {
    departmentName: string;
    employeeStatusName: string;
    employeeName: string;
    occurrenceTypeNames: string;
  };
  summary: {
    occurrenceCount: number;
    employeeCount: number;
    maxIndividualOccurrences: number;
  };
  rows: OccurrenceRankingPdfRow[];
}

const PAGE_MARGIN_X = 14;
const HEADER_HEIGHT = 30;
const HEADER_ACCENT_HEIGHT = 2;
const FILTER_SUMMARY_TITLE_Y = 42;
const FILTER_SUMMARY_START_Y = 50;
const FILTER_LINE_HEIGHT = 4.5;
const FILTER_ROW_GAP = 6;
const FILTER_BOTTOM_GAP = 9;
const METRIC_CARD_HEIGHT = 18;
const METRIC_TABLE_GAP = 12;
const NEXT_PAGE_TABLE_TOP_MARGIN = 42;
const TABLE_BOTTOM_MARGIN = 18;

function formatGeneratedAt(value: string) {
  return formatDateTime(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function sanitizeFilenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function drawHeader(doc: jsPDF, report: OccurrenceRankingPdfReport) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(17, 19, 22);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");
  doc.setFillColor(249, 115, 22);
  doc.rect(0, HEADER_HEIGHT, pageWidth, HEADER_ACCENT_HEIGHT, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Concept21 Aluminium", PAGE_MARGIN_X, 13);
  doc.setFontSize(17);
  doc.text("Ranking de Ocorrências", PAGE_MARGIN_X, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(report.periodLabel, pageWidth - PAGE_MARGIN_X, 15, { align: "right" });
  doc.text(`Emitido em ${formatGeneratedAt(report.generatedAt)}`, pageWidth - PAGE_MARGIN_X, 23, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(229, 231, 235);
    doc.line(PAGE_MARGIN_X, pageHeight - 13, pageWidth - PAGE_MARGIN_X, pageHeight - 13);
    doc.setTextColor(113, 113, 122);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Plataforma interna Concept21 Aluminium - RH", PAGE_MARGIN_X, pageHeight - 8);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - PAGE_MARGIN_X, pageHeight - 8, { align: "right" });
  }
}

function drawWrappedFilterField(doc: jsPDF, label: string, value: string, x: number, y: number, maxWidth: number) {
  const lines = doc.splitTextToSize(`${label}: ${value}`, maxWidth) as string[];

  doc.text(lines, x, y);

  return y + Math.max(lines.length - 1, 0) * FILTER_LINE_HEIGHT;
}

function drawFilterSummary(doc: jsPDF, report: OccurrenceRankingPdfReport) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN_X * 2;
  const columnGap = 8;
  const columnWidth = (contentWidth - columnGap) / 2;
  const rightX = PAGE_MARGIN_X + columnWidth + columnGap;

  doc.setTextColor(39, 39, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Filtros aplicados", PAGE_MARGIN_X, FILTER_SUMMARY_TITLE_Y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(82, 82, 91);

  const firstRowBottom = Math.max(
    drawWrappedFilterField(
      doc,
      "Departamento",
      report.filters.departmentName,
      PAGE_MARGIN_X,
      FILTER_SUMMARY_START_Y,
      columnWidth,
    ),
    drawWrappedFilterField(
      doc,
      "Status do colaborador",
      report.filters.employeeStatusName,
      rightX,
      FILTER_SUMMARY_START_Y,
      columnWidth,
    ),
  );
  const employeeY = firstRowBottom + FILTER_ROW_GAP;
  const employeeBottom = drawWrappedFilterField(
    doc,
    "Colaborador",
    report.filters.employeeName,
    PAGE_MARGIN_X,
    employeeY,
    contentWidth,
  );
  const typesY = employeeBottom + FILTER_ROW_GAP;
  const typesBottom = drawWrappedFilterField(
    doc,
    "Tipos de ocorrência",
    report.filters.occurrenceTypeNames,
    PAGE_MARGIN_X,
    typesY,
    contentWidth,
  );

  return typesBottom + FILTER_BOTTOM_GAP;
}

function drawMetricCards(doc: jsPDF, report: OccurrenceRankingPdfReport, top: number) {
  const metrics = [
    ["Ocorrências filtradas", report.summary.occurrenceCount],
    ["Colaboradores no ranking", report.summary.employeeCount],
    ["Maior volume individual", report.summary.maxIndividualOccurrences],
  ];
  const cardWidth = 58;
  const gap = 4;

  metrics.forEach(([label, value], index) => {
    const x = PAGE_MARGIN_X + index * (cardWidth + gap);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(228, 228, 231);
    doc.roundedRect(x, top, cardWidth, 18, 2, 2, "FD");
    doc.setTextColor(249, 115, 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(String(value), x + 4, top + 8);
    doc.setTextColor(82, 82, 91);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(String(label), x + 4, top + 14.5);
  });

  return top + METRIC_CARD_HEIGHT;
}

function runTable(doc: jsPDF, options: UserOptions) {
  return import("jspdf-autotable").then(({ default: autoTable }) => autoTable(doc, options));
}

function removeTrailingPagesWithoutRows(doc: jsPDF, pagesWithBodyRows: Set<number>) {
  while (doc.getNumberOfPages() > 1 && !pagesWithBodyRows.has(doc.getNumberOfPages())) {
    doc.deletePage(doc.getNumberOfPages());
  }
}

async function drawRankingTable(doc: jsPDF, report: OccurrenceRankingPdfReport, tableTitleY: number, tableStartY: number) {
  const pagesWithBodyRows = new Set<number>();

  doc.setTextColor(39, 39, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resultado do ranking", PAGE_MARGIN_X, tableTitleY);

  await runTable(doc, {
    startY: tableStartY,
    head: [
      [
        "#",
        "Colaborador",
        "Matrícula",
        "Departamento",
        "Status",
        "Ocorrências",
        "Tipos principais",
        "Última ocorrência",
        "Participação",
      ],
    ],
    body:
      report.rows.length > 0
        ? report.rows.map((row) => [
            `${row.rank}º`,
            row.employeeName,
            row.employeeNumber || "-",
            row.departmentName,
            row.employeeStatusName,
            row.occurrenceCount,
            row.typeSummary,
            formatDateTime(row.lastOccurrenceAt),
            formatPercent(row.percentage),
          ])
        : [["Sem registros para os filtros selecionados", "-", "-", "-", "-", "-", "-", "-", "-"]],
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 7.4,
      cellPadding: 1.8,
      overflow: "linebreak",
      valign: "top",
      textColor: [39, 39, 42],
    },
    headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 46 },
      2: { cellWidth: 18 },
      3: { cellWidth: 34 },
      4: { cellWidth: 22 },
      5: { cellWidth: 18, halign: "center" },
      6: { cellWidth: 56 },
      7: { cellWidth: 26 },
      8: { cellWidth: 20, halign: "right" },
    },
    margin: {
      top: NEXT_PAGE_TABLE_TOP_MARGIN,
      right: PAGE_MARGIN_X,
      bottom: TABLE_BOTTOM_MARGIN,
      left: PAGE_MARGIN_X,
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawHeader(doc, report);
      }
    },
    didDrawCell: (data) => {
      if (data.section === "body") {
        pagesWithBodyRows.add(data.pageNumber);
      }
    },
  });

  removeTrailingPagesWithoutRows(doc, pagesWithBodyRows);
}

function buildFilename(report: OccurrenceRankingPdfReport) {
  const period = sanitizeFilenamePart(report.periodLabel) || "periodo";
  return `ranking-ocorrencias-${period}.pdf`;
}

async function safeAuditLog(input: Parameters<typeof createAuditLog>[0]) {
  try {
    await createAuditLog(input);
  } catch {
    // A auditoria não deve bloquear a emissão do relatório operacional.
  }
}

function toAuditMetadata(report: OccurrenceRankingPdfReport): Record<string, JsonValue> {
  return {
    period: report.periodLabel,
    occurrence_count: report.summary.occurrenceCount,
    employee_count: report.summary.employeeCount,
    max_individual_occurrences: report.summary.maxIndividualOccurrences,
    department_filter: report.filters.departmentName,
    employee_status_filter: report.filters.employeeStatusName,
    employee_filter: report.filters.employeeName,
    occurrence_type_filter: report.filters.occurrenceTypeNames,
  };
}

export async function downloadOccurrenceRankingReportPdf(report: OccurrenceRankingPdfReport) {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  drawHeader(doc, report);
  const metricsTop = drawFilterSummary(doc, report);
  const metricsBottom = drawMetricCards(doc, report, metricsTop);
  const tableTitleY = metricsBottom + METRIC_TABLE_GAP;
  await drawRankingTable(doc, report, tableTitleY, tableTitleY + 5);
  drawFooter(doc);
  doc.save(buildFilename(report));

  await safeAuditLog({
    action: "occurrence_ranking_report.pdf_generated",
    entity: "employee_occurrences",
    metadata: toAuditMetadata(report),
  });
}
