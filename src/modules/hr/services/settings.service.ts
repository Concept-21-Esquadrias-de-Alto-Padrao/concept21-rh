import { getHrSupabaseClient, slugifyKey } from "@/modules/hr/services/service-utils";
import type { LookupRecord } from "@/modules/hr/types";

export type HrSettingEntity =
  | "company_units"
  | "departments"
  | "cost_centers"
  | "positions"
  | "employment_types"
  | "marital_statuses"
  | "dependent_relationship_types"
  | "employee_statuses"
  | "termination_reasons"
  | "employee_movement_cost_categories"
  | "document_types"
  | "leave_types"
  | "occurrence_categories"
  | "occurrence_types"
  | "trainings"
  | "roles"
  | "custom_fields"
  | "alert_rules";

export const settingEntityLabels: Record<HrSettingEntity, string> = {
  company_units: "Unidades",
  departments: "Departamentos",
  cost_centers: "Centros de custo",
  positions: "Cargos",
  employment_types: "Tipos de vínculo",
  marital_statuses: "Estados civis",
  dependent_relationship_types: "Parentescos",
  employee_statuses: "Status de colaborador",
  termination_reasons: "Motivos de desligamento",
  employee_movement_cost_categories: "Motivos de custo de admissão/desligamento",
  document_types: "Tipos de documentos",
  leave_types: "Tipos de afastamento",
  occurrence_categories: "Categorias de ocorrência",
  occurrence_types: "Tipos de ocorrência",
  trainings: "Treinamentos",
  roles: "Perfis de acesso",
  custom_fields: "Campos personalizados",
  alert_rules: "Regras de alerta",
};

function cleanUndefined(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function buildSettingPayload(
  entity: HrSettingEntity,
  input: Record<string, string | number | boolean | null | undefined>,
  options: { requireName: boolean },
) {
  const displayName = String(input.name ?? input.label ?? "").trim();
  const key = input.key ? String(input.key) : displayName ? slugifyKey(displayName) : undefined;

  if (options.requireName && !displayName) {
    throw new Error("Nome é obrigatório.");
  }

  if (entity === "custom_fields") {
    return cleanUndefined({
      label: displayName || undefined,
      key,
      entity: input.entity ? String(input.entity) : undefined,
      field_type: input.field_type ? String(input.field_type) : undefined,
      is_required: input.is_required,
      is_active: input.is_active,
    });
  }

  if (entity === "alert_rules") {
    return cleanUndefined({
      name: displayName || undefined,
      key,
      entity: input.entity ? String(input.entity) : undefined,
      event: input.event ? String(input.event) : undefined,
      days_before: input.days_before ?? null,
      severity: input.severity ? String(input.severity) : undefined,
      is_active: input.is_active,
    });
  }

  if (entity === "document_types") {
    return cleanUndefined({
      name: displayName || undefined,
      key,
      description: input.description,
      requires_expiration_date: input.requires_expiration_date,
      default_validity_months: input.default_validity_months ?? null,
      is_active: input.is_active,
    });
  }

  if (entity === "trainings") {
    return cleanUndefined({
      name: displayName || undefined,
      key,
      description: input.description,
      validity_months: input.validity_months ?? null,
      is_required: input.is_required,
      is_active: input.is_active,
    });
  }

  if (entity === "occurrence_types") {
    return cleanUndefined({
      name: displayName || undefined,
      key,
      description: input.description,
      include_in_daily_report: input.include_in_daily_report,
      counts_as_absence: input.counts_as_absence,
      counts_as_medical_certificate: input.counts_as_medical_certificate,
      is_punishment: input.is_punishment,
      punishment_level: input.punishment_level,
      priority_order: input.priority_order,
      is_active: input.is_active,
    });
  }

  if (entity === "dependent_relationship_types") {
    return cleanUndefined({
      name: displayName || undefined,
      key,
      description: input.description,
      is_child: input.is_child,
      is_spouse: input.is_spouse,
      is_parent: input.is_parent,
      is_active: input.is_active,
    });
  }

  if (entity === "employee_movement_cost_categories") {
    return cleanUndefined({
      name: displayName || undefined,
      key,
      description: input.description,
      movement_type: input.movement_type ? String(input.movement_type) : "both",
      is_active: input.is_active,
    });
  }

  return cleanUndefined({
    name: displayName || undefined,
    key,
    description: input.description,
    is_active: input.is_active,
  });
}

export async function listSettingItems(entity: HrSettingEntity) {
  const supabase = getHrSupabaseClient();
  let query = supabase.from(entity).select("*");

  if (
    !["roles", "alert_rules"].includes(entity)
  ) {
    query = query.order("sort_order", { ascending: true });
  }

  query = query.order(entity === "custom_fields" ? "label" : "name", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as LookupRecord[];
}

export async function createSettingItem(
  entity: HrSettingEntity,
  input: Record<string, string | number | boolean | null | undefined>,
) {
  const supabase = getHrSupabaseClient();
  const payload = {
    ...buildSettingPayload(entity, input, { requireName: true }),
    is_active: input.is_active ?? true,
  };

  const { data, error } = await (supabase.from(entity) as never as {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: unknown; error: Error | null }>;
      };
    };
  })
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as LookupRecord;
}

export async function updateSettingItem(
  entity: HrSettingEntity,
  itemId: string,
  input: Record<string, string | number | boolean | null | undefined>,
) {
  const supabase = getHrSupabaseClient();
  const payload = buildSettingPayload(entity, input, { requireName: false });
  const { data, error } = await supabase
    .from(entity)
    .update(payload)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as LookupRecord;
}

export async function inactivateSettingItem(entity: HrSettingEntity, itemId: string) {
  return updateSettingItem(entity, itemId, { is_active: false });
}

export async function reactivateSettingItem(entity: HrSettingEntity, itemId: string) {
  return updateSettingItem(entity, itemId, { is_active: true });
}
