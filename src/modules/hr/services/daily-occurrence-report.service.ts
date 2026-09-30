import { createAuditLog } from "@/modules/hr/services/audit.service";
import { getHrSupabaseClient, todayIsoDate } from "@/modules/hr/services/service-utils";
import type {
  DailyOccurrenceReport,
  DailyOccurrenceReportItem,
  DailyOccurrenceReportWithAuthor,
  Department,
  EmployeeOccurrence,
  ID,
  OccurrenceType,
  Profile,
} from "@/modules/hr/types";
import { isDailyReportOccurrenceType } from "@/modules/hr/utils/occurrences";

export interface DailyOccurrenceReportFilters {
  departmentId?: ID;
  departmentIds?: ID[];
  occurrenceTypeId?: ID;
  occurrenceTypeIds?: ID[];
  reportDate?: string;
  limit?: number;
}

export interface DailyOccurrenceReportGroup {
  departmentId: ID | null;
  departmentName: string;
  sortOrder: number;
  occurrences: EmployeeOccurrence[];
}

export interface GeneratedDailyOccurrenceReportItem {
  occurrence: EmployeeOccurrence;
  displayText: string;
  sortOrder: number;
}

export interface GeneratedDailyOccurrenceReport {
  reportDate: string;
  generatedText: string;
  occurrences: EmployeeOccurrence[];
  groups: DailyOccurrenceReportGroup[];
  items: GeneratedDailyOccurrenceReportItem[];
}

function assertIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Data inválida para o relatório diário.");
  }
}

function formatDateBR(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatDayMonth(date?: string | null) {
  if (!date) {
    return "";
  }

  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function addDays(date: string, amount: number) {
  const utcDate = new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))),
  );
  utcDate.setUTCDate(utcDate.getUTCDate() + amount);
  return utcDate.toISOString().slice(0, 10);
}

function calculateInclusiveDays(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) {
    return null;
  }

  const start = Date.UTC(
    Number(startDate.slice(0, 4)),
    Number(startDate.slice(5, 7)) - 1,
    Number(startDate.slice(8, 10)),
  );
  const end = Date.UTC(
    Number(endDate.slice(0, 4)),
    Number(endDate.slice(5, 7)) - 1,
    Number(endDate.slice(8, 10)),
  );

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return Math.floor((end - start) / 86_400_000) + 1;
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

function normalizeId(value?: ID) {
  return value?.trim() || undefined;
}

function getOccurrencePriority(occurrence: EmployeeOccurrence) {
  const type = occurrence.occurrence_type;

  if (typeof type?.priority_order === "number") {
    return type.priority_order;
  }

  const key = `${type?.key ?? ""} ${type?.name ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (type?.counts_as_medical_certificate || key.includes("atestado")) {
    return 1;
  }

  if (key.includes("afastamento")) {
    return 2;
  }

  if (key.includes("justificada")) {
    return 3;
  }

  if (key.includes("falta")) {
    return 4;
  }

  if (key.includes("ausencia")) {
    return 5;
  }

  return 99;
}

function getOccurrenceDepartment(occurrence: EmployeeOccurrence): Department | null {
  return occurrence.department ?? occurrence.employee?.department ?? null;
}

function getDepartmentName(occurrence: EmployeeOccurrence) {
  return getOccurrenceDepartment(occurrence)?.name ?? "Sem departamento";
}

function getDepartmentSortOrder(occurrence: EmployeeOccurrence) {
  return getOccurrenceDepartment(occurrence)?.sort_order ?? 999;
}

async function safeAuditLog(input: Parameters<typeof createAuditLog>[0]) {
  try {
    await createAuditLog(input);
  } catch {
    // Auditoria é desejável, mas não deve impedir a operação principal do relatório.
  }
}

async function listDailyReportOccurrenceTypes(filters: DailyOccurrenceReportFilters = {}) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("occurrence_types")
    .select("*, occurrence_category:occurrence_categories(*)")
    .eq("is_active", true)
    .eq("include_in_daily_report", true)
    .order("priority_order", { ascending: true })
    .order("sort_order", { ascending: true });

  const occurrenceTypeIds = Array.from(new Set(filters.occurrenceTypeIds?.map(normalizeId).filter(Boolean) ?? [])) as ID[];
  const occurrenceTypeId = normalizeId(filters.occurrenceTypeId);

  if (occurrenceTypeIds.length > 0) {
    query = query.in("id", occurrenceTypeIds);
  } else if (occurrenceTypeId) {
    query = query.eq("id", occurrenceTypeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OccurrenceType[]).filter(isDailyReportOccurrenceType);
}

export async function getOccurrencesByReportDate(
  date: string = todayIsoDate(),
  filters: DailyOccurrenceReportFilters = {},
) {
  assertIsoDate(date);

  const supabase = getHrSupabaseClient();
  const reportTypes = await listDailyReportOccurrenceTypes(filters);
  const typeIds = reportTypes.map((type) => type.id);

  if (typeIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("employee_occurrences")
    .select(
      `
      *,
      employee:employees(id, full_name, employee_number, department_id),
      department:departments(*),
      occurrence_type:occurrence_types(*),
      occurrence_category:occurrence_categories(*)
    `,
    )
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("occurrence_type_id", typeIds)
    .or(`and(start_date.lte.${date},end_date.gte.${date}),and(start_date.eq.${date},end_date.is.null)`)
    .order("created_at", { ascending: true });

  const departmentIds = Array.from(new Set(filters.departmentIds?.map(normalizeId).filter(Boolean) ?? [])) as ID[];
  const departmentId = normalizeId(filters.departmentId);

  if (departmentIds.length > 0) {
    query = query.in("department_id", departmentIds);
  } else if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as EmployeeOccurrence[]).filter(
    (occurrence) => !["cancelled", "rejected"].includes(occurrence.status),
  );
}

export function removeDuplicateEmployees(occurrences: EmployeeOccurrence[]) {
  const ordered = [...occurrences].sort((first, second) => {
    const priorityDiff = getOccurrencePriority(first) - getOccurrencePriority(second);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return (first.created_at ?? "").localeCompare(second.created_at ?? "");
  });
  const byEmployee = new Map<ID, EmployeeOccurrence>();

  for (const occurrence of ordered) {
    if (!byEmployee.has(occurrence.employee_id)) {
      byEmployee.set(occurrence.employee_id, occurrence);
    }
  }

  return Array.from(byEmployee.values());
}

export function groupOccurrencesByDepartment(occurrences: EmployeeOccurrence[]) {
  const grouped = new Map<string, DailyOccurrenceReportGroup>();

  for (const occurrence of occurrences) {
    const department = getOccurrenceDepartment(occurrence);
    const departmentId = occurrence.department_id ?? department?.id ?? null;
    const key = departmentId ?? getDepartmentName(occurrence);
    const current = grouped.get(key);

    if (current) {
      current.occurrences.push(occurrence);
      continue;
    }

    grouped.set(key, {
      departmentId,
      departmentName: getDepartmentName(occurrence),
      sortOrder: getDepartmentSortOrder(occurrence),
      occurrences: [occurrence],
    });
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      occurrences: [...group.occurrences].sort((first, second) =>
        (first.employee?.full_name ?? "").localeCompare(second.employee?.full_name ?? "", "pt-BR"),
      ),
    }))
    .sort((first, second) => {
      const sortDiff = first.sortOrder - second.sortOrder;
      return sortDiff !== 0 ? sortDiff : first.departmentName.localeCompare(second.departmentName, "pt-BR");
    });
}

export function formatOccurrenceLine(occurrence: EmployeeOccurrence, reportDate: string) {
  const employeeName = occurrence.employee?.full_name ?? "Colaborador sem nome";
  const summary = normalizeText(occurrence.justification_summary);
  const type = occurrence.occurrence_type;
  const totalDays =
    occurrence.total_days ?? calculateInclusiveDays(occurrence.start_date, occurrence.end_date) ?? null;
  const isMedicalCertificate =
    Boolean(type?.counts_as_medical_certificate) ||
    `${type?.key ?? ""} ${type?.name ?? ""}`.toLowerCase().includes("atestado");

  if (
    isMedicalCertificate &&
    totalDays === 2 &&
    occurrence.start_date === addDays(reportDate, -1) &&
    occurrence.end_date === reportDate
  ) {
    return `- ${employeeName} (Atestado ontem e hoje)`;
  }

  if (isMedicalCertificate && totalDays && totalDays > 1) {
    const suffix = occurrence.end_date ? `, finalizando no dia ${formatDayMonth(occurrence.end_date)}` : "";
    return `- ${employeeName} (${totalDays} dias de atestado${suffix})`;
  }

  if (summary) {
    return `- ${employeeName} (Justificativa: ${summary})`;
  }

  if (occurrence.end_date && occurrence.end_date !== occurrence.start_date) {
    const typeName = normalizeText(type?.name) || "Ocorrência";
    return `- ${employeeName} (${typeName}, finalizando no dia ${formatDayMonth(occurrence.end_date)})`;
  }

  return `- ${employeeName}`;
}

export async function generateDailyOccurrenceReport(
  date: string = todayIsoDate(),
  filters: DailyOccurrenceReportFilters = {},
): Promise<GeneratedDailyOccurrenceReport> {
  assertIsoDate(date);

  const occurrences = removeDuplicateEmployees(await getOccurrencesByReportDate(date, filters));
  const groups = groupOccurrencesByDepartment(occurrences);
  const items = groups.flatMap((group) =>
    group.occurrences.map((occurrence, index) => ({
      occurrence,
      displayText: formatOccurrenceLine(occurrence, date),
      sortOrder: index + 1,
    })),
  );

  const header = `Bom diaa! 🌞\n${formatDateBR(date)}\n\n`;

  if (groups.length === 0) {
    return {
      reportDate: date,
      generatedText: `${header}Sem registros de faltas, atestados ou ausências para hoje.`,
      occurrences,
      groups,
      items,
    };
  }

  const body = groups
    .map((group) => {
      const employeeCount = new Set(group.occurrences.map((occurrence) => occurrence.employee_id)).size;
      const lines = group.occurrences.map((occurrence) => formatOccurrenceLine(occurrence, date)).join("\n");

      return `${group.departmentName}: ${String(employeeCount).padStart(2, "0")}\n${lines}`;
    })
    .join("\n\n");

  return {
    reportDate: date,
    generatedText: `${header}${body}`,
    occurrences,
    groups,
    items,
  };
}

export async function saveGeneratedOccurrenceReport(input: {
  reportDate: string;
  generatedText: string;
  editedText?: string | null;
  items?: GeneratedDailyOccurrenceReportItem[];
}) {
  assertIsoDate(input.reportDate);

  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("daily_occurrence_reports")
    .insert({
      report_date: input.reportDate,
      generated_text: input.generatedText,
      edited_text: input.editedText ?? input.generatedText,
      generated_by: user.data.user?.id,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const report = data as DailyOccurrenceReport;
  const itemRows =
    input.items?.map((item, index) => ({
      report_id: report.id,
      employee_id: item.occurrence.employee_id,
      department_id: item.occurrence.department_id ?? getOccurrenceDepartment(item.occurrence)?.id ?? null,
      occurrence_id: item.occurrence.id,
      occurrence_type_id: item.occurrence.occurrence_type_id,
      display_text: item.displayText,
      sort_order: item.sortOrder || index + 1,
    })) ?? [];

  if (itemRows.length > 0) {
    const { error: itemError } = await supabase.from("daily_occurrence_report_items").insert(itemRows);

    if (itemError) {
      throw new Error(itemError.message);
    }
  }

  await safeAuditLog({
    action: "daily_occurrence_report.generated",
    entity: "daily_occurrence_reports",
    entity_id: report.id,
    new_value: report,
    metadata: {
      report_date: report.report_date,
      items_count: itemRows.length,
    },
  });

  return report;
}

export async function updateGeneratedOccurrenceReportText(reportId: ID, editedText: string) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("daily_occurrence_reports")
    .update({ edited_text: editedText })
    .eq("id", reportId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "daily_occurrence_report.edited",
    entity: "daily_occurrence_reports",
    entity_id: reportId,
    new_value: data,
  });

  return data as DailyOccurrenceReport;
}

export async function markOccurrenceReportAsCopied(reportId: ID) {
  const copiedAt = new Date().toISOString();
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("daily_occurrence_reports")
    .update({ copied_at: copiedAt })
    .eq("id", reportId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "daily_occurrence_report.copied",
    entity: "daily_occurrence_reports",
    entity_id: reportId,
    new_value: data,
  });

  return data as DailyOccurrenceReport;
}

async function hydrateReportAuthors(reports: DailyOccurrenceReport[]) {
  const generatedByIds = Array.from(new Set(reports.map((report) => report.generated_by).filter(Boolean))) as ID[];

  if (generatedByIds.length === 0) {
    return reports.map((report) => ({ ...report, generated_by_profile: null }));
  }

  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("auth_user_id, full_name, email")
    .in("auth_user_id", generatedByIds);

  if (error) {
    return reports.map((report) => ({ ...report, generated_by_profile: null }));
  }

  const profilesByAuthId = new Map(
    ((data ?? []) as Pick<Profile, "auth_user_id" | "full_name" | "email">[]).map((profile) => [
      profile.auth_user_id,
      profile,
    ]),
  );

  return reports.map((report) => ({
    ...report,
    generated_by_profile: report.generated_by ? profilesByAuthId.get(report.generated_by) ?? null : null,
  }));
}

export async function listDailyOccurrenceReports(filters: DailyOccurrenceReportFilters = {}) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("daily_occurrence_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 10);

  if (filters.reportDate) {
    assertIsoDate(filters.reportDate);
    query = query.eq("report_date", filters.reportDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return hydrateReportAuthors((data ?? []) as DailyOccurrenceReport[]);
}

export async function getDailyOccurrenceReportById(reportId: ID): Promise<DailyOccurrenceReportWithAuthor> {
  const supabase = getHrSupabaseClient();
  const reportResult = await supabase
    .from("daily_occurrence_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (reportResult.error) {
    throw new Error(reportResult.error.message);
  }

  const itemsResult = await supabase
    .from("daily_occurrence_report_items")
    .select("*")
    .eq("report_id", reportId)
    .order("sort_order", { ascending: true });

  if (itemsResult.error) {
    throw new Error(itemsResult.error.message);
  }

  const [report] = await hydrateReportAuthors([reportResult.data as DailyOccurrenceReport]);

  return {
    ...report,
    items: (itemsResult.data ?? []) as DailyOccurrenceReportItem[],
  };
}
