import { createAuditLog, createEmployeeHistoryEvent } from "@/modules/hr/services/audit.service";
import { getHrSupabaseClient, slugifyKey } from "@/modules/hr/services/service-utils";
import type { EmployeeTraining, ID, Training } from "@/modules/hr/types";

export async function listTrainings(includeInactive = false) {
  const supabase = getHrSupabaseClient();
  let query = supabase.from("trainings").select("*").order("sort_order", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Training[];
}

export async function createTraining(input: Partial<Training> & Pick<Training, "name">) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("trainings")
    .insert({
      ...input,
      key: input.key ?? slugifyKey(input.name),
      is_active: input.is_active ?? true,
      is_required: input.is_required ?? false,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "training.created",
    entity: "trainings",
    entity_id: data.id,
    new_value: data,
  });

  return data as Training;
}

export async function updateTraining(trainingId: ID, input: Partial<Training>) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("trainings")
    .update(input)
    .eq("id", trainingId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "training.updated",
    entity: "trainings",
    entity_id: trainingId,
    new_value: data,
  });

  return data as Training;
}

export async function inactivateTraining(trainingId: ID) {
  return updateTraining(trainingId, { is_active: false });
}

export async function listEmployeeTrainings(employeeId?: ID) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_trainings")
    .select("*, employee:employees(id, full_name, employee_number), training:trainings(*)")
    .is("deleted_at", null)
    .order("expiration_date", { ascending: true, nullsFirst: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeTraining[];
}

export async function createEmployeeTraining(
  input: Partial<EmployeeTraining> &
    Pick<EmployeeTraining, "employee_id" | "training_id" | "completion_date">,
) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_trainings")
    .insert(input)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "employee_training.created",
    entity: "employee_trainings",
    entity_id: data.id,
    new_value: data,
  });

  await createEmployeeHistoryEvent({
    employee_id: input.employee_id,
    event_type: "training_completed",
    title: "Treinamento registrado",
    description: "Treinamento/certificação vinculado ao colaborador.",
    source_entity: "employee_trainings",
    source_entity_id: data.id,
  });

  return data as EmployeeTraining;
}
