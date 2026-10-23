import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";
import type { MonthlyOccurrenceReport } from "./monthly-occurrence-report.service";

const PAGE_MARGIN_X = 14;
const HEADER_HEIGHT = 34;
const HEADER_ACCENT_HEIGHT = 2;
const NEXT_PAGE_TABLE_TOP_MARGIN = 44;
const TABLE_BOTTOM_MARGIN = 18;
const DETAIL_SECTION_TITLE_GAP = 8;
const DETAIL_SECTION_TABLE_GAP = 5;
const MIN_DETAIL_SECTION_SPACE = 78;

function formatDateBR(date?: string | null) {
  if (!date) {
    return "-";
  }

  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function drawHeader(doc: jsPDF, report: MonthlyOccurrenceReport) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(17, 19, 22);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");
  doc.setFillColor(249, 115, 22);
  doc.rect(0, HEADER_HEIGHT, pageWidth, HEADER_ACCENT_HEIGHT, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Concept21 Aluminium", PAGE_MARGIN_X, 14);
  doc.setFontSize(18);
  doc.text("Relatório Mensal de Ocorrências", PAGE_MARGIN_X, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Competência ${report.competenceLabel}`, pageWidth - PAGE_MARGIN_X, 17, { align: "right" });
  doc.text(`Emitido em ${formatDateBR(report.generatedAt)}`, pageWidth - PAGE_MARGIN_X, 25, { align: "right" });
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

function drawFilterSummary(doc: jsPDF, report: MonthlyOccurrenceReport) {
  const width = doc.internal.pageSize.getWidth() - 2 * PAGE_MARGIN_X;
  const bottom = doc.internal.pageSize.getHeight() - TABLE_BOTTOM_MARGIN;
  let y = 47;
  doc.setTextColor(39, 39, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Filtros aplicados", PAGE_MARGIN_X, 47);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(82, 82, 91);
  const entries = [
    `Departamento: ${report.filters.departmentName}`,
    `Colaborador: ${report.filters.employeeName}`,
    `Tipo de ocorrência: ${report.filters.occurrenceTypeName}`,
    `Escopo: ${
      report.filters.onlyPayrollRelevant
        ? "somente ocorrências com impacto de folha/ausência"
        : "todas as ocorrências"
    }`,
  ];
  y += 7;
  for (const entry of entries) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines: string[] = doc.splitTextToSize(entry, width);
    for (const line of lines) {
      if (y + 4 > bottom) {
        doc.addPage();
        drawHeader(doc, report);
        y = NEXT_PAGE_TABLE_TOP_MARGIN;
      }
      doc.setTextColor(82, 82, 91);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(line, PAGE_MARGIN_X, y);
      y += 4.5;
    }
    y += 1.5;
  }
  return y + 5;
}

function drawMetricCards(doc: jsPDF, report: MonthlyOccurrenceReport, requestedTop: number) {
  const metrics = [
    ["Ocorrências", report.summary.occurrenceCount],
    ["Colaboradores", report.summary.employeeCount],
    ["Departamentos", report.summary.departmentCount],
    ["Dias impactados", report.summary.impactDays],
    ["Atrasos", report.summary.delayCount],
    ["Atestados", report.summary.medicalCertificateCount],
  ];
  const cardWidth = 28.5;
  const gap = 2;
  let top = requestedTop;
  if (top + 38 > doc.internal.pageSize.getHeight() - TABLE_BOTTOM_MARGIN) {
    doc.addPage();
    drawHeader(doc, report);
    top = NEXT_PAGE_TABLE_TOP_MARGIN;
  }

  metrics.forEach(([label, value], index) => {
    const x = PAGE_MARGIN_X + index * (cardWidth + gap);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(228, 228, 231);
    doc.roundedRect(x, top, cardWidth, 18, 2, 2, "FD");
    doc.setTextColor(249, 115, 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(String(value), x + 3, top + 8);
    doc.setTextColor(82, 82, 91);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(String(label), x + 3, top + 14);
  });
  return top + 28;
}

function lastAutoTableY(doc: jsPDF, fallback: number) {
  return (
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback
  );
}

function runTable(doc: jsPDF, options: UserOptions) {
  return import("jspdf-autotable").then(({ autoTable }) => autoTable(doc, options));
}

function getCurrentPageNumber(doc: jsPDF) {
  return (
    (doc as unknown as { internal: { getCurrentPageInfo?: () => { pageNumber: number } } }).internal
      .getCurrentPageInfo?.().pageNumber ?? doc.getNumberOfPages()
  );
}

function drawContinuationHeader(doc: jsPDF, report: MonthlyOccurrenceReport) {
  if (getCurrentPageNumber(doc) > 1) {
    drawHeader(doc, report);
  }
}

function getTableMargin() {
  return {
    top: NEXT_PAGE_TABLE_TOP_MARGIN,
    right: PAGE_MARGIN_X,
    bottom: TABLE_BOTTOM_MARGIN,
    left: PAGE_MARGIN_X,
  };
}

function getDetailSectionTitleY(doc: jsPDF, report: MonthlyOccurrenceReport, requestedY: number) {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (requestedY + MIN_DETAIL_SECTION_SPACE <= pageHeight - TABLE_BOTTOM_MARGIN) {
    return requestedY;
  }

  doc.addPage();
  drawHeader(doc, report);

  return NEXT_PAGE_TABLE_TOP_MARGIN;
}

async function drawTables(doc: jsPDF, report: MonthlyOccurrenceReport, startY: number) {
  await runTable(doc, {
    startY,
    head: [
      [
        "Departamento",
        "Colaboradores",
        "Ocorrências",
        "Dias",
        "Faltas/Ausências",
        "Atrasos",
        "Atestados",
      ],
    ],
    body:
      report.departmentSummaries.length > 0
        ? report.departmentSummaries.map((item) => [
            item.departmentName,
            item.employeeCount,
            item.occurrenceCount,
            item.impactDays,
            item.absenceCount,
            item.delayCount,
            item.medicalCertificateCount,
          ])
        : [["Sem registros", "-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: [39, 39, 42] },
    headStyles: { fillColor: [17, 19, 22], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: getTableMargin(),
    willDrawPage: () => {
      drawContinuationHeader(doc, report);
    },
  });

  const detailTitleY = getDetailSectionTitleY(
    doc,
    report,
    lastAutoTableY(doc, startY) + DETAIL_SECTION_TITLE_GAP,
  );
  doc.setTextColor(39, 39, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalhamento por colaborador", PAGE_MARGIN_X, detailTitleY);

  await runTable(doc, {
    startY: detailTitleY + DETAIL_SECTION_TABLE_GAP,
    head: [["Colaborador", "Matrícula", "Departamento", "Tipo", "Período", "Dias", "Status", "Resumo"]],
    body:
      report.rows.length > 0
        ? report.rows.flatMap((row) => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.2);
            const lines: string[] = doc.splitTextToSize(row.justification, 42 - 3.4);
            const chunks: (string | number)[][] = [];
            // Bounded rows keep the employee identity beside each part of the summary.
            for (let offset = 0; offset < Math.max(lines.length, 1); offset += 18) {
              chunks.push([
                row.employeeName + (offset > 0 ? " (continuação)" : ""),
                row.employeeNumber,
                row.departmentName,
                row.typeName,
                row.periodLabel,
                offset === 0 ? row.impactDays : "-",
                row.statusLabel,
                lines.slice(offset, offset + 18).join("\n"),
              ]);
            }
            return chunks;
          })
        : [["Sem registros para a competência selecionada", "-", "-", "-", "-", "-", "-", "-"]],
    rowPageBreak: "avoid",
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: 1.7,
      overflow: "linebreak",
      valign: "top",
      textColor: [39, 39, 42],
    },
    headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 27 },
      1: { cellWidth: 16 },
      2: { cellWidth: 23 },
      3: { cellWidth: 23 },
      4: { cellWidth: 24 },
      5: { cellWidth: 10, halign: "center" },
      6: { cellWidth: 17 },
      7: { cellWidth: 42 },
    },
    margin: getTableMargin(),
    willDrawPage: () => {
      drawContinuationHeader(doc, report);
    },
  });
}

export async function createMonthlyOccurrenceReportPdf(report: MonthlyOccurrenceReport) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawHeader(doc, report);
  const metricsTop = drawFilterSummary(doc, report);
  const tableTop = drawMetricCards(doc, report, metricsTop);
  await drawTables(doc, report, tableTop);
  drawFooter(doc);
  return doc;
}
