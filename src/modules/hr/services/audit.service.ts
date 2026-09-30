import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type { AuditLog, EmployeeHistoryEvent, ID, JsonValue } from "@/modules/hr/types";

export async function createAuditLog(input: {
  action: string;
  entity: string;
  entity_id?: ID;
  old_value?: unknown;
  new_value?: unknown;
  metadata?: Record<string, JsonValue>;
}) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();

  const { error } = await supabase.from("audit_logs").insert({
    action: input.action,
    entity: input.entity,
    entity_id: input.entity_id,
    actor_auth_user_id: user.data.user?.id,
    old_value: input.old_value,
    new_value: input.new_value,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listAuditLogs(limit = 100) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AuditLog[];
}

export async function createEmployeeHistoryEvent(input: {
  employee_id: ID;
  event_type: string;
  title: string;
  description?: string;
  source_entity?: string;
  source_entity_id?: ID;
  metadata?: Record<string, JsonValue>;
}) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();

  const { error } = await supabase.from("employee_history_events").insert({
    ...input,
    created_by: user.data.user?.id,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listEmployeeHistory(employeeId: ID) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_history_events")
    .select("*")
    .eq("employee_id", employeeId)
    .order("event_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmployeeHistoryEvent[];
}
