import { createAuditLog, createEmployeeHistoryEvent } from "@/modules/hr/services/audit.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type { EmployeeLeave, ID, Vacation, WorkflowStatus } from "@/modules/hr/types";

export async function listVacations(employeeId?: ID) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("vacations")
    .select("*, employee:employees(id, full_name, employee_number)")
    .is("deleted_at", null)
    .order("vacation_start", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Vacation[];
}

export async function createVacation(input: Partial<Vacation> & Pick<Vacation, "employee_id" | "accrual_period_start" | "accrual_period_end" | "vacation_start" | "vacation_end" | "days_count">) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase.from("vacations").insert(input).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "vacation.created",
    entity: "vacations",
    entity_id: data.id,
    new_value: data,
  });

  await createEmployeeHistoryEvent({
    employee_id: input.employee_id,
    event_type: "vacation_requested",
    title: "Férias registradas",
    description: "Período de férias cadastrado.",
    source_entity: "vacations",
    source_entity_id: data.id,
  });

  return data as Vacation;
}

export async function updateVacationStatus(vacationId: ID, status: WorkflowStatus) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("vacations")
    .update({ status })
    .eq("id", vacationId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "vacation.status_updated",
    entity: "vacations",
    entity_id: vacationId,
    new_value: data,
  });

  return data as Vacation;
}

export async function listLeaves(employeeId?: ID) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_leaves")
    .select("*, employee:employees(id, full_name, employee_number), leave_type:leave_types(*)")
    .is("deleted_at", null)
    .order("start_date", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeLeave[];
}

export async function listLeaveTypes() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("leave_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createLeave(input: Partial<EmployeeLeave> & Pick<EmployeeLeave, "employee_id" | "leave_type_id" | "start_date">) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase.from("employee_leaves").insert(input).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "leave.created",
    entity: "employee_leaves",
    entity_id: data.id,
    new_value: data,
  });

  return data as EmployeeLeave;
}

export async function updateLeaveStatus(leaveId: ID, status: WorkflowStatus) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_leaves")
    .update({ status })
    .eq("id", leaveId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "leave.status_updated",
    entity: "employee_leaves",
    entity_id: leaveId,
    new_value: data,
  });

  return data as EmployeeLeave;
}
