import { createAuditLog } from "@/modules/hr/services/audit.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type { Department, EmployeeOccurrence, ID } from "@/modules/hr/types";
import {
  isAbsenceOccurrenceType,
  isDayImpactingOccurrenceType,
  isDelayOccurrenceType,
  isMedicalCertificateOccurrenceType,
  isPayrollRelevantOccurrenceType,
} from "@/modules/hr/utils/occurrences";
import { occurrenceStatusLabels } from "@/modules/hr/utils/status";

export interface MonthlyOccurrenceReportFilters {
  departmentId?: ID;
  departmentIds?: ID[];
  employeeId?: ID;
  employeeIds?: ID[];
  occurrenceTypeId?: ID;
  occurrenceTypeIds?: ID[];
  onlyPayrollRelevant?: boolean;
}

export interface MonthlyOccurrenceReportRow {
  occurrence: EmployeeOccurrence;
  employeeName: string;
  employeeNumber: string;
  departmentName: string;
  typeName: string;
  title: string;
  periodLabel: string;
  statusLabel: string;
  impactDays: number;
  justification: string;
}

export interface MonthlyOccurrenceDepartmentSummary {
  departmentName: string;
  employeeCount: number;
  occurrenceCount: number;
  impactDays: number;
  absenceCount: number;
  delayCount: number;
  medicalCertificateCount: number;
}

export interface MonthlyOccurrenceReport {
  competence: string;
  competenceLabel: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  filters: {
    departmentName: string;
    employeeName: string;
    occurrenceTypeName: string;
    onlyPayrollRelevant: boolean;
  };
  summary: {
    occurrenceCount: number;
    employeeCount: number;
    departmentCount: number;
    impactDays: number;
    absenceCount: number;
    delayCount: number;
    medicalCertificateCount: number;
  };
  departmentSummaries: MonthlyOccurrenceDepartmentSummary[];
  rows: MonthlyOccurrenceReportRow[];
}

const statusLabels: Record<string, string> = occurrenceStatusLabels;
function assertCompetence(competence: string) {
  if (!/^\d{4}-\d{2}$/.test(competence)) {
    throw new Error("Competência inválida. Use o formato MM/AAAA.");
  }
}

function parseCompetence(competence: string) {
  assertCompetence(competence);

  const year = Number(competence.slice(0, 4));
  const month = Number(competence.slice(5, 7));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const nextStart = new Date(Date.UTC(year, month, 1));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    nextMonthStartDate: nextStart.toISOString().slice(0, 10),
    competenceLabel: `${String(month).padStart(2, "0")}/${year}`,
  };
}

function formatDateBR(date?: string | null) {
  if (!date) {
    return "-";
  }

  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function normalizeText(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bCID\s*[:.-]?\s*[A-Z]\d{0,2}(?:\.\d+)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getUtcTime(date: string) {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

function countInclusiveDays(startDate: string, endDate: string) {
  return Math.floor((getUtcTime(endDate) - getUtcTime(startDate)) / 86_400_000) + 1;
}

function clampDate(date: string, minDate: string, maxDate: string) {
  if (date < minDate) {
    return minDate;
  }

  if (date > maxDate) {
    return maxDate;
  }

  return date;
}

function getOccurrenceStartDate(occurrence: EmployeeOccurrence) {
  return occurrence.start_date ?? occurrence.occurred_at.slice(0, 10);
}

function getOccurrenceEndDate(occurrence: EmployeeOccurrence) {
  return occurrence.end_date ?? getOccurrenceStartDate(occurrence);
}

function getImpactDaysInCompetence(occurrence: EmployeeOccurrence, startDate: string, endDate: string) {
  if (!isDayImpactingOccurrenceType(occurrence.occurrence_type)) {
    return 0;
  }

  const occurrenceStart = getOccurrenceStartDate(occurrence);
  const occurrenceEnd = getOccurrenceEndDate(occurrence);
  const clampedStart = clampDate(occurrenceStart, startDate, endDate);
  const clampedEnd = clampDate(occurrenceEnd, startDate, endDate);

  if (clampedEnd < clampedStart) {
    return 0;
  }

  return countInclusiveDays(clampedStart, clampedEnd);
}

function getDepartment(occurrence: EmployeeOccurrence): Department | null {
  return occurrence.department ?? occurrence.employee?.department ?? null;
}

function getDepartmentName(occurrence: EmployeeOccurrence) {
  return getDepartment(occurrence)?.name ?? "Sem departamento";
}

function getDepartmentSortOrder(occurrence: EmployeeOccurrence) {
  return getDepartment(occurrence)?.sort_order ?? 999;
}

function getTypeSortOrder(occurrence: EmployeeOccurrence) {
  return occurrence.occurrence_type?.priority_order ?? occurrence.occurrence_type?.sort_order ?? 999;
}

function isMissingExtendedOccurrenceSchema(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";

  return (
    message.includes("schema cache") ||
    message.includes("start_date") ||
    message.includes("end_date") ||
    message.includes("department_id")
  );
}

function isMissingPayrollTypeFlags(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";

  return (
    message.includes("schema cache") ||
    message.includes("include_in_daily_report") ||
    message.includes("counts_as_absence") ||
    message.includes("counts_as_medical_certificate")
  );
}

interface OccurrenceTypeBase {
  id: ID;
  key?: string | null;
  name?: string | null;
  include_in_daily_report?: boolean | null;
  counts_as_absence?: boolean | null;
  counts_as_medical_certificate?: boolean | null;
}

function normalizeIds(values?: ID[]) {
  return Array.from(new Set(values?.map((value) => value.trim()).filter(Boolean) ?? []));
}

function sortRows(rows: MonthlyOccurrenceReportRow[]) {
  return [...rows].sort((first, second) => {
    const departmentDiff =
      getDepartmentSortOrder(first.occurrence) - getDepartmentSortOrder(second.occurrence);

    if (departmentDiff !== 0) {
      return departmentDiff;
    }

    const nameDiff = first.employeeName.localeCompare(second.employeeName, "pt-BR");

    if (nameDiff !== 0) {
      return nameDiff;
    }

    const typeDiff = getTypeSortOrder(first.occurrence) - getTypeSortOrder(second.occurrence);

    if (typeDiff !== 0) {
      return typeDiff;
    }

    return getOccurrenceStartDate(first.occurrence).localeCompare(getOccurrenceStartDate(second.occurrence));
  });
}

async function safeAuditLog(input: Parameters<typeof createAuditLog>[0]) {
  try {
    await createAuditLog(input);
  } catch {
    // A auditoria não deve bloquear a emissão do relatório operacional.
  }
}

async function getPayrollRelevantTypeIds(filters: MonthlyOccurrenceReportFilters) {
  const occurrenceTypeIds = normalizeIds(filters.occurrenceTypeIds);

  if (occurrenceTypeIds.length > 0) {
    return occurrenceTypeIds;
  }

  const occurrenceTypeId = filters.occurrenceTypeId?.trim();

  if (occurrenceTypeId) {
    return [occurrenceTypeId];
  }

  if (!filters.onlyPayrollRelevant) {
    return null;
  }

  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("occurrence_types")
    .select("id, key, name, include_in_daily_report, counts_as_absence, counts_as_medical_certificate")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    if (!isMissingPayrollTypeFlags(error)) {
      throw new Error(error.message);
    }

    const legacyTypes = await supabase
      .from("occurrence_types")
      .select("id, key, name")
      .eq("is_active", true);

    if (legacyTypes.error) {
      throw new Error(legacyTypes.error.message);
    }

    return ((legacyTypes.data ?? []) as OccurrenceTypeBase[])
      .filter(isPayrollRelevantOccurrenceType)
      .map((type) => type.id);
  }

  return ((data ?? []) as OccurrenceTypeBase[]).filter(isPayrollRelevantOccurrenceType).map((type) => type.id);
}

async function listMonthlyOccurrences(
  startDate: string,
  endDate: string,
  nextMonthStartDate: string,
  filters: MonthlyOccurrenceReportFilters,
) {
  const supabase = getHrSupabaseClient();
  const typeIds = await getPayrollRelevantTypeIds(filters);

  if (typeIds && typeIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("employee_occurrences")
    .select(
      `
      *,
      employee:employees(id, full_name, employee_number, department_id, department:departments(*)),
      department:departments(*),
      occurrence_type:occurrence_types(*),
      occurrence_category:occurrence_categories(*)
    `,
    )
    .eq("is_active", true)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .neq("status", "rejected")
    .or(
      `and(start_date.lte.${endDate},end_date.gte.${startDate}),and(start_date.gte.${startDate},start_date.lte.${endDate},end_date.is.null),and(start_date.is.null,occurred_at.gte.${startDate}T00:00:00,occurred_at.lt.${nextMonthStartDate}T00:00:00)`,
    )
    .order("occurred_at", { ascending: true });

  if (typeIds) {
    query = query.in("occurrence_type_id", typeIds);
  }

  const departmentIds = normalizeIds(filters.departmentIds);
  const employeeIds = normalizeIds(filters.employeeIds);

  if (departmentIds.length > 0) {
    query = query.in("department_id", departmentIds);
  } else if (filters.departmentId?.trim()) {
    query = query.eq("department_id", filters.departmentId.trim());
  }

  if (employeeIds.length > 0) {
    query = query.in("employee_id", employeeIds);
  } else if (filters.employeeId?.trim()) {
    query = query.eq("employee_id", filters.employeeId.trim());
  }

  const { data, error } = await query;

  if (!error) {
    return (data ?? []) as unknown as EmployeeOccurrence[];
  }

  if (!isMissingExtendedOccurrenceSchema(error)) {
    throw new Error(error.message);
  }

  let legacyQuery = supabase
    .from("employee_occurrences")
    .select(
      `
      *,
      employee:employees(id, full_name, employee_number, department_id, department:departments(*)),
      occurrence_type:occurrence_types(*),
      occurrence_category:occurrence_categories(*)
    `,
    )
    .eq("is_active", true)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .neq("status", "rejected")
    .gte("occurred_at", `${startDate}T00:00:00`)
    .lt("occurred_at", `${nextMonthStartDate}T00:00:00`)
    .order("occurred_at", { ascending: true });

  if (typeIds) {
    legacyQuery = legacyQuery.in("occurrence_type_id", typeIds);
  }

  if (employeeIds.length > 0) {
    legacyQuery = legacyQuery.in("employee_id", employeeIds);
  } else if (filters.employeeId?.trim()) {
    legacyQuery = legacyQuery.eq("employee_id", filters.employeeId.trim());
  }

  const legacyResult = await legacyQuery;

  if (legacyResult.error) {
    throw new Error(legacyResult.error.message);
  }

  const legacyOccurrences = (legacyResult.data ?? []) as unknown as EmployeeOccurrence[];

  if (departmentIds.length === 0 && !filters.departmentId?.trim()) {
    return legacyOccurrences;
  }

  const selectedDepartmentIds = departmentIds.length > 0 ? departmentIds : [filters.departmentId?.trim()].filter(Boolean);

  return legacyOccurrences.filter((occurrence) =>
    selectedDepartmentIds.includes(occurrence.employee?.department_id ?? ""),
  );
}

async function resolveFilterNames(filters: MonthlyOccurrenceReportFilters) {
  const supabase = getHrSupabaseClient();
  const departmentIds = normalizeIds(filters.departmentIds);
  const employeeIds = normalizeIds(filters.employeeIds);
  const occurrenceTypeIds = normalizeIds(filters.occurrenceTypeIds);
  const [departmentResult, employeeResult, occurrenceTypeResult] = await Promise.all([
    departmentIds.length > 0
      ? supabase.from("departments").select("name").in("id", departmentIds).order("name")
      : filters.departmentId
        ? supabase.from("departments").select("name").eq("id", filters.departmentId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    employeeIds.length > 0
      ? supabase.from("employees").select("full_name, employee_number").in("id", employeeIds).order("full_name")
      : filters.employeeId
        ? supabase.from("employees").select("full_name, employee_number").eq("id", filters.employeeId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    occurrenceTypeIds.length > 0
      ? supabase.from("occurrence_types").select("name").in("id", occurrenceTypeIds).order("name")
      : filters.occurrenceTypeId
        ? supabase.from("occurrence_types").select("name").eq("id", filters.occurrenceTypeId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
  ]);
  const departmentRows = Array.isArray(departmentResult.data) ? departmentResult.data : [];
  const employeeRows = Array.isArray(employeeResult.data) ? employeeResult.data : [];
  const occurrenceTypeRows = Array.isArray(occurrenceTypeResult.data) ? occurrenceTypeResult.data : [];
  const employee = Array.isArray(employeeResult.data) ? null : employeeResult.data;

  return {
    departmentName:
      departmentRows.length > 0
        ? departmentRows.map((department) => department.name).join(", ")
        : Array.isArray(departmentResult.data)
          ? "Departamentos não localizados"
          : departmentResult.data?.name ?? "Todos os departamentos",
    employeeName:
      employeeRows.length > 0
        ? employeeRows
            .map((item) => `${item.full_name}${item.employee_number ? ` (${item.employee_number})` : ""}`)
            .join(", ")
        : employee
          ? `${employee.full_name}${employee.employee_number ? ` (${employee.employee_number})` : ""}`
          : "Todos os colaboradores",
    occurrenceTypeName:
      occurrenceTypeRows.length > 0
        ? occurrenceTypeRows.map((type) => type.name).join(", ")
        : Array.isArray(occurrenceTypeResult.data)
          ? "Tipos não localizados"
          : occurrenceTypeResult.data?.name ?? "Todos os tipos",
  };
}

export async function generateMonthlyOccurrenceReport(
  competence: string,
  filters: MonthlyOccurrenceReportFilters = {},
): Promise<MonthlyOccurrenceReport> {
  const { startDate, endDate, nextMonthStartDate, competenceLabel } = parseCompetence(competence);
  const normalizedFilters = {
    ...filters,
    onlyPayrollRelevant: filters.onlyPayrollRelevant ?? true,
  };
  const [occurrences, filterNames] = await Promise.all([
    listMonthlyOccurrences(startDate, endDate, nextMonthStartDate, normalizedFilters),
    resolveFilterNames(normalizedFilters),
  ]);

  const rows = sortRows(
    occurrences.map((occurrence) => {
      const impactDays = getImpactDaysInCompetence(occurrence, startDate, endDate);
      const start = getOccurrenceStartDate(occurrence);
      const end = getOccurrenceEndDate(occurrence);

      return {
        occurrence,
        employeeName: occurrence.employee?.full_name ?? "Colaborador sem nome",
        employeeNumber: occurrence.employee?.employee_number ?? "-",
        departmentName: getDepartmentName(occurrence),
        typeName: occurrence.occurrence_type?.name ?? "-",
        title: occurrence.title,
        periodLabel: start === end ? formatDateBR(start) : `${formatDateBR(start)} a ${formatDateBR(end)}`,
        statusLabel: statusLabels[occurrence.status] ?? occurrence.status,
        impactDays,
        justification:
          normalizeText(occurrence.justification_summary) ||
          normalizeText(occurrence.description) ||
          "-",
      };
    }),
  );

  const departmentMap = new Map<string, MonthlyOccurrenceDepartmentSummary>();

  for (const row of rows) {
    const key = row.departmentName;
    const current =
      departmentMap.get(key) ??
      ({
        departmentName: row.departmentName,
        employeeCount: 0,
        occurrenceCount: 0,
        impactDays: 0,
        absenceCount: 0,
        delayCount: 0,
        medicalCertificateCount: 0,
      } satisfies MonthlyOccurrenceDepartmentSummary);
    const type = row.occurrence.occurrence_type;

    current.occurrenceCount += 1;
    current.impactDays += row.impactDays;
    current.absenceCount += isAbsenceOccurrenceType(type) ? 1 : 0;
    current.delayCount += isDelayOccurrenceType(type) ? 1 : 0;
    current.medicalCertificateCount += isMedicalCertificateOccurrenceType(type) ? 1 : 0;
    departmentMap.set(key, current);
  }

  const employeesByDepartment = new Map<string, Set<ID>>();

  for (const row of rows) {
    const set = employeesByDepartment.get(row.departmentName) ?? new Set<ID>();
    set.add(row.occurrence.employee_id);
    employeesByDepartment.set(row.departmentName, set);
  }

  const departmentSummaries = Array.from(departmentMap.values())
    .map((summary) => ({
      ...summary,
      employeeCount: employeesByDepartment.get(summary.departmentName)?.size ?? 0,
    }))
    .sort((first, second) => first.departmentName.localeCompare(second.departmentName, "pt-BR"));
  const employeeCount = new Set(rows.map((row) => row.occurrence.employee_id)).size;
  const generatedAt = new Date().toISOString();

  return {
    competence,
    competenceLabel,
    startDate,
    endDate,
    generatedAt,
    filters: {
      departmentName: filterNames.departmentName,
      employeeName: filterNames.employeeName,
      occurrenceTypeName: filterNames.occurrenceTypeName,
      onlyPayrollRelevant: normalizedFilters.onlyPayrollRelevant,
    },
    summary: {
      occurrenceCount: rows.length,
      employeeCount,
      departmentCount: departmentSummaries.length,
      impactDays: rows.reduce((total, row) => total + row.impactDays, 0),
      absenceCount: rows.filter((row) => isAbsenceOccurrenceType(row.occurrence.occurrence_type)).length,
      delayCount: rows.filter((row) => isDelayOccurrenceType(row.occurrence.occurrence_type)).length,
      medicalCertificateCount: rows.filter((row) =>
        isMedicalCertificateOccurrenceType(row.occurrence.occurrence_type),
      ).length,
    },
    departmentSummaries,
    rows,
  };
}

function buildFilename(report: MonthlyOccurrenceReport) {
  return `relatorio-mensal-ocorrencias-${report.competence}.pdf`;
}

export async function downloadMonthlyOccurrenceReportPdf(report: MonthlyOccurrenceReport) {
  const { createMonthlyOccurrenceReportPdf } = await import("./monthly-occurrence-report-pdf");
  const doc = await createMonthlyOccurrenceReportPdf(report);
  doc.save(buildFilename(report));

  await safeAuditLog({
    action: "monthly_occurrence_report.pdf_generated",
    entity: "employee_occurrences",
    metadata: {
      competence: report.competence,
      occurrence_count: report.summary.occurrenceCount,
      employee_count: report.summary.employeeCount,
      department_count: report.summary.departmentCount,
      employee_filter: report.filters.employeeName,
    },
  });
}

export function getMonthlyOccurrenceReportPeriodLabel(report: MonthlyOccurrenceReport) {
  return `${formatDateBR(report.startDate)} a ${formatDateBR(report.endDate)}`;
}

export function getDefaultCompetence() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 7);
}

