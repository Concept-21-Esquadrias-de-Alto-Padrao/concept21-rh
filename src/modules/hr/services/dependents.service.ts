import { createAuditLog, createEmployeeHistoryEvent } from "@/modules/hr/services/audit.service";
import { ensureCurrentUserIsMaster } from "@/modules/hr/services/auth.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type { EmployeeDependent, ID } from "@/modules/hr/types";

export type EmployeeDependentInput = Partial<EmployeeDependent> &
  Pick<EmployeeDependent, "employee_id" | "full_name">;

const dependentSelect = "*, relationship_type:dependent_relationship_types(*)";

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

function normalizeDependentPayload(input: EmployeeDependentInput | Partial<EmployeeDependent>) {
  return cleanUndefined({
    employee_id: cleanString(input.employee_id),
    relationship_type_id: cleanString(input.relationship_type_id),
    full_name: input.full_name?.trim(),
    relationship: cleanString(input.relationship),
    birth_date: cleanString(input.birth_date),
    document_number: cleanString(input.document_number),
    consider_for_commemorative_dates: input.consider_for_commemorative_dates ?? true,
    consider_as_internal_dependent: input.consider_as_internal_dependent ?? true,
    notes: cleanString(input.notes),
    is_active: input.is_active ?? true,
  });
}

export async function listEmployeeDependents(employeeId: ID) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_dependents")
    .select(dependentSelect)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeDependent[];
}

export async function createEmployeeDependent(input: EmployeeDependentInput) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const payload = normalizeDependentPayload(input);

  if (!payload.full_name) {
    throw new Error("Nome do dependente é obrigatório.");
  }

  const { data, error } = await supabase
    .from("employee_dependents")
    .insert({
      ...payload,
      created_by: user.data.user?.id,
      updated_by: user.data.user?.id,
    })
    .select(dependentSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "employee_dependent.created",
    entity: "employee_dependents",
    entity_id: data.id,
    new_value: data,
  });

  await createEmployeeHistoryEvent({
    employee_id: input.employee_id,
    event_type: "dependent_created",
    title: "Dependente cadastrado",
    description: input.full_name,
    source_entity: "employee_dependents",
    source_entity_id: data.id,
  });

  return data as EmployeeDependent;
}

export async function updateEmployeeDependent(dependentId: ID, input: Partial<EmployeeDependent>) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const before = await supabase
    .from("employee_dependents")
    .select(dependentSelect)
    .eq("id", dependentId)
    .single();

  if (before.error) {
    throw new Error(before.error.message);
  }

  const payload = normalizeDependentPayload(input);
  const { data, error } = await supabase
    .from("employee_dependents")
    .update({
      ...payload,
      updated_by: user.data.user?.id,
    })
    .eq("id", dependentId)
    .select(dependentSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "employee_dependent.updated",
    entity: "employee_dependents",
    entity_id: dependentId,
    old_value: before.data,
    new_value: data,
  });

  return data as EmployeeDependent;
}

export async function setEmployeeDependentActive(dependentId: ID, isActive: boolean) {
  return updateEmployeeDependent(dependentId, { is_active: isActive });
}

export async function deleteEmployeeDependent(dependentId: ID) {
  await ensureCurrentUserIsMaster();

  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const before = await supabase
    .from("employee_dependents")
    .select("*")
    .eq("id", dependentId)
    .single();

  if (before.error) {
    throw new Error(before.error.message);
  }

  const { data, error } = await supabase
    .from("employee_dependents")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_by: user.data.user?.id,
    })
    .eq("id", dependentId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "employee_dependent.removed",
    entity: "employee_dependents",
    entity_id: dependentId,
    old_value: before.data,
    new_value: data,
  });

  await createEmployeeHistoryEvent({
    employee_id: (before.data as EmployeeDependent).employee_id,
    event_type: "dependent_removed",
    title: "Dependente removido",
    description: (before.data as EmployeeDependent).full_name,
    source_entity: "employee_dependents",
    source_entity_id: dependentId,
  });

  return data as EmployeeDependent;
}
