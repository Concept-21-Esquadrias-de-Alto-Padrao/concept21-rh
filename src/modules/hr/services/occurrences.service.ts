import { createAuditLog, createEmployeeHistoryEvent } from "@/modules/hr/services/audit.service";
import { ensureCurrentUserIsMaster } from "@/modules/hr/services/auth.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type {
  EmployeeOccurrence,
  ID,
  OccurrenceCategory,
  OccurrenceStatus,
  OccurrenceType,
} from "@/modules/hr/types";

export async function listOccurrenceCategories() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("occurrence_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as OccurrenceCategory[];
}

export async function listOccurrenceTypes() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("occurrence_types")
    .select("*, occurrence_category:occurrence_categories(*)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as OccurrenceType[];
}

export async function listOccurrences(employeeId?: ID) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_occurrences")
    .select(
      `
      *,
      employee:employees(id, full_name, employee_number, department_id, department:departments(*)),
      occurrence_type:occurrence_types(*),
      occurrence_category:occurrence_categories(*)
    `,
    )
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeOccurrence[];
}

function cleanString(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function cleanUndefined(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function toPositiveInteger(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.trunc(numberValue) : null;
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

async function getEmployeeDepartmentId(employeeId: ID) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employees")
    .select("department_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data?.department_id ?? null;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }

  return "";
}

function isMissingDailyReportColumnError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("schema cache") ||
    message.includes("department_id") ||
    message.includes("start_date") ||
    message.includes("end_date") ||
    message.includes("total_days") ||
    message.includes("justification_summary") ||
    message.includes("internal_notes")
  );
}

function toLegacyOccurrencePayload(payload: Record<string, unknown>) {
  const legacyPayload = { ...payload };
  delete legacyPayload.department_id;
  delete legacyPayload.start_date;
  delete legacyPayload.end_date;
  delete legacyPayload.total_days;
  delete legacyPayload.justification_summary;
  delete legacyPayload.internal_notes;
  return legacyPayload;
}

function normalizeOccurrencePayload(
  input: Partial<EmployeeOccurrence> &
    Pick<EmployeeOccurrence, "employee_id" | "occurrence_type_id" | "title" | "description">,
  options: { userId?: string; departmentId?: string | null },
) {
  const occurredAt = input.occurred_at ?? new Date().toISOString();
  const startDate = (cleanString(input.start_date) as string | null | undefined) ?? occurredAt.slice(0, 10);
  const endDate = cleanString(input.end_date) as string | null | undefined;
  const totalDays = toPositiveInteger(input.total_days) ?? calculateInclusiveDays(startDate, endDate);

  return cleanUndefined({
    ...input,
    employee_id: input.employee_id,
    occurrence_type_id: input.occurrence_type_id,
    occurrence_category_id: cleanString(input.occurrence_category_id),
    department_id: cleanString(input.department_id) ?? options.departmentId ?? null,
    title: input.title.trim(),
    description: input.description.trim(),
    occurred_at: occurredAt,
    start_date: startDate,
    end_date: endDate,
    total_days: totalDays,
    justification_summary: cleanString(input.justification_summary),
    internal_notes: cleanString(input.internal_notes),
    notes: cleanString(input.notes),
    registered_by: options.userId,
    created_by: options.userId,
    updated_by: options.userId,
  });
}

function normalizeOccurrenceUpdatePayload(input: Partial<EmployeeOccurrence>) {
  const payload = { ...input } as Record<string, unknown>;

  for (const key of [
    "occurrence_category_id",
    "department_id",
    "start_date",
    "end_date",
    "justification_summary",
    "internal_notes",
    "notes",
  ]) {
    if (key in payload) {
      payload[key] = cleanString(payload[key]);
    }
  }

  if ("total_days" in payload) {
    payload.total_days = toPositiveInteger(payload.total_days);
  }

  return cleanUndefined(payload);
}

export async function createOccurrence(
  input: Partial<EmployeeOccurrence> &
    Pick<EmployeeOccurrence, "employee_id" | "occurrence_type_id" | "title" | "description">,
) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const departmentId = await getEmployeeDepartmentId(input.employee_id);
  const payload = normalizeOccurrencePayload(input, {
    userId: user.data.user?.id,
    departmentId,
  });

  let { data, error } = await supabase
    .from("employee_occurrences")
    .insert(payload)
    .select("*")
    .single();

  if (error && isMissingDailyReportColumnError(error)) {
    const retry = await supabase
      .from("employee_occurrences")
      .insert(toLegacyOccurrencePayload(payload))
      .select("*")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "occurrence.created",
    entity: "employee_occurrences",
    entity_id: data.id,
    new_value: data,
  });

  await createEmployeeHistoryEvent({
    employee_id: input.employee_id,
    event_type: "occurrence_registered",
    title: "Ocorrência registrada",
    description: input.title,
    source_entity: "employee_occurrences",
    source_entity_id: data.id,
  });

  return data as EmployeeOccurrence;
}

export async function updateOccurrence(occurrenceId: ID, input: Partial<EmployeeOccurrence>) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const payload = normalizeOccurrenceUpdatePayload({
    ...input,
    updated_by: user.data.user?.id,
  });
  const { data, error } = await supabase
    .from("employee_occurrences")
    .update(payload)
    .eq("id", occurrenceId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "occurrence.updated",
    entity: "employee_occurrences",
    entity_id: occurrenceId,
    new_value: data,
  });

  return data as EmployeeOccurrence;
}

export async function updateOccurrenceStatus(occurrenceId: ID, status: OccurrenceStatus) {
  return updateOccurrence(occurrenceId, { status });
}

export async function deleteOccurrence(occurrenceId: ID) {
  await ensureCurrentUserIsMaster();

  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const beforeResult = await supabase
    .from("employee_occurrences")
    .select("*")
    .eq("id", occurrenceId)
    .single();

  if (beforeResult.error) {
    throw new Error(beforeResult.error.message);
  }

  const { data, error } = await supabase
    .from("employee_occurrences")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      status: "cancelled",
      updated_by: user.data.user?.id,
    })
    .eq("id", occurrenceId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "occurrence.removed",
    entity: "employee_occurrences",
    entity_id: occurrenceId,
    old_value: beforeResult.data,
    new_value: data,
  });

  const occurrence = beforeResult.data as EmployeeOccurrence;

  await createEmployeeHistoryEvent({
    employee_id: occurrence.employee_id,
    event_type: "occurrence_removed",
    title: "Ocorrência removida",
    description: occurrence.title,
    source_entity: "employee_occurrences",
    source_entity_id: occurrenceId,
  });

  return data as EmployeeOccurrence;
}
