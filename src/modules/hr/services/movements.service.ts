import { createAuditLog, createEmployeeHistoryEvent } from "@/modules/hr/services/audit.service";
import { ensureCurrentUserIsMaster } from "@/modules/hr/services/auth.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type {
  Employee,
  EmployeeMovement,
  EmployeeMovementCostCategory,
  EmployeeMovementCostCategoryScope,
  EmployeeMovementCostItem,
  EmployeeMovementStatus,
  EmployeeMovementType,
  ID,
} from "@/modules/hr/types";
import { normalizeReferenceMonth, roundMoney, toNumber } from "@/modules/hr/utils/labor-cost-calculations";
import { validateRequiredEmployeeFields } from "@/modules/hr/utils/validation";

export interface EmployeeMovementFilters {
  referenceMonth?: string;
  movementType?: EmployeeMovementType | "";
  movementTypes?: EmployeeMovementType[];
  employeeId?: ID;
  employeeIds?: ID[];
  departmentId?: ID;
  departmentIds?: ID[];
  status?: EmployeeMovementStatus | "";
  statuses?: EmployeeMovementStatus[];
}

export interface EmployeeMovementCostItemInput {
  id?: ID;
  description?: string;
  cost_category?: string;
  amount?: number | string | null;
  is_deduction?: boolean;
  notes?: string | null;
  sort_order?: number;
}

export interface AdmissionEmployeeInput {
  full_name?: string;
  cpf?: string;
  employee_number?: string;
  email?: string | null;
  phone?: string | null;
  department_id?: ID | null;
  position_id?: ID | null;
  employment_type_id?: ID | null;
  status_id?: ID | null;
}

export interface EmployeeMovementInput {
  employee_id?: ID;
  admission_employee?: AdmissionEmployeeInput;
  movement_type: EmployeeMovementType;
  movement_date: string;
  status: EmployeeMovementStatus;
  termination_reason_id?: ID | null;
  notes?: string | null;
  cost_items?: EmployeeMovementCostItemInput[];
}

export interface EmployeeMovementSummary {
  admissions: number;
  terminations: number;
  admissionTotal: number;
  terminationTotal: number;
  total: number;
}

export const movementCostCategoryScopeLabels: Record<EmployeeMovementCostCategoryScope, string> = {
  admission: "Admissão",
  termination: "Desligamento",
  both: "Admissão e desligamento",
};

export const defaultMovementCostCategories: EmployeeMovementCostCategory[] = [
  {
    id: "admission_exam",
    name: "Exame admissional",
    key: "admission_exam",
    description: "Custos de exame admissional.",
    movement_type: "admission",
    sort_order: 10,
    is_active: true,
    created_at: "",
  },
  {
    id: "admission_documents",
    name: "Documentação",
    key: "admission_documents",
    description: "Custos de documentação admissional.",
    movement_type: "admission",
    sort_order: 20,
    is_active: true,
    created_at: "",
  },
  {
    id: "admission_training",
    name: "Integração / treinamento",
    key: "admission_training",
    description: "Custos iniciais de integração ou treinamento.",
    movement_type: "admission",
    sort_order: 30,
    is_active: true,
    created_at: "",
  },
  {
    id: "admission_equipment",
    name: "EPI / uniforme",
    key: "admission_equipment",
    description: "Custos de EPI, uniforme ou equipamento na admissão.",
    movement_type: "admission",
    sort_order: 40,
    is_active: true,
    created_at: "",
  },
  {
    id: "admission_bonus",
    name: "Ajuda / bônus",
    key: "admission_bonus",
    description: "Ajuda, bônus ou verba inicial de admissão.",
    movement_type: "admission",
    sort_order: 50,
    is_active: true,
    created_at: "",
  },
  {
    id: "termination_salary_balance",
    name: "Saldo de salário",
    key: "termination_salary_balance",
    description: "Saldo de salário no desligamento.",
    movement_type: "termination",
    sort_order: 10,
    is_active: true,
    created_at: "",
  },
  {
    id: "termination_notice",
    name: "Aviso prévio",
    key: "termination_notice",
    description: "Custos relacionados ao aviso prévio.",
    movement_type: "termination",
    sort_order: 20,
    is_active: true,
    created_at: "",
  },
  {
    id: "termination_vacation",
    name: "Férias rescisórias",
    key: "termination_vacation",
    description: "Férias vencidas, proporcionais e adicionais rescisórios.",
    movement_type: "termination",
    sort_order: 30,
    is_active: true,
    created_at: "",
  },
  {
    id: "termination_13th",
    name: "13º salário",
    key: "termination_13th",
    description: "13º salário rescisório.",
    movement_type: "termination",
    sort_order: 40,
    is_active: true,
    created_at: "",
  },
  {
    id: "termination_fgts",
    name: "FGTS / multa",
    key: "termination_fgts",
    description: "FGTS, multa e guias relacionadas ao desligamento.",
    movement_type: "termination",
    sort_order: 50,
    is_active: true,
    created_at: "",
  },
  {
    id: "termination_tax",
    name: "Guias / taxas",
    key: "termination_tax",
    description: "Guias, taxas e encargos acessórios de desligamento.",
    movement_type: "termination",
    sort_order: 60,
    is_active: true,
    created_at: "",
  },
  {
    id: "discount",
    name: "Desconto / abatimento",
    key: "discount",
    description: "Desconto ou abatimento aplicado ao custo do movimento.",
    movement_type: "termination",
    sort_order: 70,
    is_active: true,
    created_at: "",
  },
  {
    id: "other",
    name: "Outros",
    key: "other",
    description: "Outros custos de admissão ou desligamento.",
    movement_type: "both",
    sort_order: 999,
    is_active: true,
    created_at: "",
  },
];

type NormalizedMovementCostItem = Omit<
  EmployeeMovementCostItem,
  "id" | "movement_id" | "created_at" | "updated_at" | "is_active" | "deleted_at"
>;

const movementSelect = `
  *,
  employee:employees(
    id,
    full_name,
    employee_number,
    department_id,
    position_id,
    status_id,
    department:departments(*),
    position:positions(*),
    status:employee_statuses(*)
  ),
  termination_reason:termination_reasons(*),
  cost_items:employee_movement_cost_items(*)
`;

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

function referenceMonthFromDate(date: string) {
  return normalizeReferenceMonth(date).slice(0, 10);
}

function isMissingMovementsTable(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";

  return (
    message.includes("employee_movements") ||
    message.includes("employee_movement_cost_items") ||
    message.includes("employee_movement_cost_categories") ||
    message.includes("schema cache")
  );
}

export function filterMovementCostCategories(
  categories: EmployeeMovementCostCategory[],
  movementType: EmployeeMovementType,
  selectedKeys: string[] = [],
) {
  const selected = new Set(selectedKeys);

  return categories
    .filter(
      (category) =>
        (category.is_active || selected.has(category.key)) &&
        (category.movement_type === "both" || category.movement_type === movementType),
    )
    .sort((left, right) => {
      const sortDiff = (left.sort_order ?? 0) - (right.sort_order ?? 0);

      if (sortDiff !== 0) {
        return sortDiff;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });
}

export async function listEmployeeMovementCostCategories(options: { includeInactive?: boolean } = {}) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_movement_cost_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingMovementsTable(error)) {
      return options.includeInactive
        ? defaultMovementCostCategories
        : defaultMovementCostCategories.filter((category) => category.is_active);
    }

    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeMovementCostCategory[];
}

function normalizeMovementItems(items: EmployeeMovementCostItemInput[] = []) {
  return items
    .map((item, index) => {
      const description = String(item.description ?? "").trim();
      const notes = cleanString(item.notes);
      const amount = roundMoney(Math.max(0, toNumber(item.amount)));

      if (!description && amount <= 0 && !notes) {
        return null;
      }

      return {
        description,
        cost_category: String(item.cost_category ?? "other"),
        amount,
        is_deduction: Boolean(item.is_deduction),
        notes,
        sort_order: item.sort_order ?? index,
      };
    })
    .filter(Boolean) as NormalizedMovementCostItem[];
}

export function calculateMovementTotal(items: Array<Pick<EmployeeMovementCostItem, "amount" | "is_deduction">>) {
  return roundMoney(
    items.reduce((total, item) => total + (item.is_deduction ? -toNumber(item.amount) : toNumber(item.amount)), 0),
  );
}

async function createEmployeeForAdmission(
  admissionEmployee: AdmissionEmployeeInput | undefined,
  hireDate: string,
  authUserId?: ID | null,
) {
  const validation = validateRequiredEmployeeFields({
    ...admissionEmployee,
    hire_date: hireDate,
  });

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employees")
    .insert({
      full_name: admissionEmployee?.full_name?.trim(),
      cpf: normalizeCpf(admissionEmployee?.cpf ?? ""),
      employee_number: admissionEmployee?.employee_number?.trim(),
      hire_date: hireDate,
      email: cleanString(admissionEmployee?.email),
      phone: cleanString(admissionEmployee?.phone),
      department_id: cleanString(admissionEmployee?.department_id),
      position_id: cleanString(admissionEmployee?.position_id),
      employment_type_id: cleanString(admissionEmployee?.employment_type_id),
      status_id: cleanString(admissionEmployee?.status_id),
      is_active: true,
      created_by: authUserId,
      updated_by: authUserId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const created = data as Employee;

  await createAuditLog({
    action: "employee.created",
    entity: "employees",
    entity_id: created.id,
    new_value: created,
  });

  await createEmployeeHistoryEvent({
    employee_id: created.id,
    event_type: "admission",
    title: "Colaborador cadastrado",
    description: `Colaborador ${created.full_name} cadastrado durante o lançamento de admissão.`,
    source_entity: "employees",
    source_entity_id: created.id,
  });

  return created;
}

function sortMovementItems(movement: EmployeeMovement) {
  return {
    ...movement,
    cost_items: [...(movement.cost_items ?? [])].filter((item) => item.is_active && !item.deleted_at).sort((first, second) => {
      const sortDiff = (first.sort_order ?? 0) - (second.sort_order ?? 0);

      if (sortDiff !== 0) {
        return sortDiff;
      }

      return first.description.localeCompare(second.description, "pt-BR");
    }),
  };
}

function summarizeMovements(movements: EmployeeMovement[]): EmployeeMovementSummary {
  return movements.reduce(
    (summary, movement) => {
      if (movement.status === "cancelled") {
        return summary;
      }

      if (movement.movement_type === "admission") {
        summary.admissions += 1;
        summary.admissionTotal = roundMoney(summary.admissionTotal + toNumber(movement.total_amount));
      } else {
        summary.terminations += 1;
        summary.terminationTotal = roundMoney(summary.terminationTotal + toNumber(movement.total_amount));
      }

      summary.total = roundMoney(summary.admissionTotal + summary.terminationTotal);
      return summary;
    },
    {
      admissions: 0,
      terminations: 0,
      admissionTotal: 0,
      terminationTotal: 0,
      total: 0,
    },
  );
}

function validateMovementInput(input: EmployeeMovementInput) {
  if (!input.movement_date) {
    throw new Error("Informe a data do movimento.");
  }

  if (!["admission", "termination"].includes(input.movement_type)) {
    throw new Error("Tipo de movimento inválido.");
  }

  if (!["planned", "completed", "cancelled"].includes(input.status)) {
    throw new Error("Status do movimento inválido.");
  }

  if (input.movement_type === "termination" && !input.employee_id) {
    throw new Error("Selecione o colaborador que será desligado.");
  }

  if (input.movement_type === "admission" && !input.employee_id) {
    const validation = validateRequiredEmployeeFields({
      ...input.admission_employee,
      hire_date: input.movement_date,
    });

    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }
  }
}

function movementLabel(type: EmployeeMovementType) {
  return type === "admission" ? "Admissão" : "Desligamento";
}

async function getEmployeeStatusId(preferredKey: string, fallbackKeys: string[] = []) {
  const supabase = getHrSupabaseClient();
  const keys = Array.from(new Set([preferredKey, ...fallbackKeys]));
  const { data, error } = await supabase
    .from("employee_statuses")
    .select("id, key")
    .in("key", keys)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return data?.find((status) => status.key === preferredKey)?.id ?? data?.[0]?.id ?? null;
}

async function getTerminalStatusId() {
  return getEmployeeStatusId("desligado", ["inativo"]);
}

async function getActiveStatusId() {
  return getEmployeeStatusId("ativo");
}

async function syncEmployeeFromMovement(movement: EmployeeMovement, authUserId?: ID | null) {
  if (movement.status !== "completed") {
    return;
  }

  const supabase = getHrSupabaseClient();

  if (movement.movement_type === "admission") {
    const { error } = await supabase
      .from("employees")
      .update({
        hire_date: movement.movement_date,
        updated_by: authUserId,
      })
      .eq("id", movement.employee_id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const terminalStatusId = await getTerminalStatusId();
  const payload: Record<string, unknown> = {
    is_active: false,
    termination_date: movement.movement_date,
    termination_reason_id: movement.termination_reason_id ?? null,
    updated_by: authUserId,
  };

  if (terminalStatusId) {
    payload.status_id = terminalStatusId;
  }

  const { error } = await supabase.from("employees").update(payload).eq("id", movement.employee_id);

  if (error) {
    throw new Error(error.message);
  }
}

async function syncEmployeeFromLatestCompletedMovement(employeeId: ID, authUserId?: ID | null) {
  const supabase = getHrSupabaseClient();
  const { data: latestMovement, error: latestMovementError } = await supabase
    .from("employee_movements")
    .select(movementSelect)
    .eq("employee_id", employeeId)
    .eq("status", "completed")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestMovementError) {
    throw new Error(latestMovementError.message);
  }

  if (!latestMovement) {
    return;
  }

  const movement = latestMovement as unknown as EmployeeMovement;

  if (movement.movement_type === "termination") {
    await syncEmployeeFromMovement(movement, authUserId);
    return;
  }

  const [activeStatusId, currentEmployee] = await Promise.all([
    getActiveStatusId(),
    supabase
      .from("employees")
      .select("status:employee_statuses(key)")
      .eq("id", employeeId)
      .maybeSingle(),
  ]);

  if (currentEmployee.error) {
    throw new Error(currentEmployee.error.message);
  }

  const currentStatusKey = (currentEmployee.data as { status?: { key?: string | null } | null } | null)?.status?.key;
  const payload: Record<string, unknown> = {
    hire_date: movement.movement_date,
    is_active: true,
    termination_date: null,
    termination_reason_id: null,
    updated_by: authUserId,
  };

  if (activeStatusId && ["inativo", "desligado"].includes(currentStatusKey ?? "")) {
    payload.status_id = activeStatusId;
  }

  const { error } = await supabase.from("employees").update(payload).eq("id", employeeId);

  if (error) {
    throw new Error(error.message);
  }
}

async function assertNoExistingActiveTermination(employeeId: ID, excludeMovementId?: ID) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_movements")
    .select("id, movement_date")
    .eq("employee_id", employeeId)
    .eq("movement_type", "termination")
    .neq("status", "cancelled")
    .eq("is_active", true)
    .is("deleted_at", null)
    .limit(1);

  if (excludeMovementId) {
    query = query.neq("id", excludeMovementId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  if (data?.length) {
    throw new Error(
      "Este colaborador já possui um desligamento registrado. Exclua ou cancele o desligamento existente antes de registrar outro.",
    );
  }
}

async function replaceMovementItems(
  movementId: ID,
  items: NormalizedMovementCostItem[],
  authUserId?: ID | null,
) {
  const supabase = getHrSupabaseClient();
  const { error: deactivateError } = await supabase
    .from("employee_movement_cost_items")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_by: authUserId,
    })
    .eq("movement_id", movementId)
    .is("deleted_at", null);

  if (deactivateError) {
    throw new Error(deactivateError.message);
  }

  if (items.length === 0) {
    return;
  }

  const { error } = await supabase.from("employee_movement_cost_items").insert(
    items.map((item) => ({
      ...item,
      movement_id: movementId,
      is_active: true,
      created_by: authUserId,
      updated_by: authUserId,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function listEmployeeMovements(filters: EmployeeMovementFilters = {}) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_movements")
    .select(movementSelect)
    .is("deleted_at", null)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.referenceMonth) {
    query = query.eq("reference_month", normalizeReferenceMonth(filters.referenceMonth));
  }

  if (filters.movementTypes && filters.movementTypes.length > 0) {
    query = query.in("movement_type", Array.from(new Set(filters.movementTypes)));
  } else if (filters.movementType) {
    query = query.eq("movement_type", filters.movementType);
  }

  if (filters.employeeIds && filters.employeeIds.length > 0) {
    query = query.in("employee_id", Array.from(new Set(filters.employeeIds)));
  } else if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }

  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in("status", Array.from(new Set(filters.statuses)));
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as EmployeeMovement[])
    .map(sortMovementItems)
    .filter((movement) => {
      if (filters.departmentIds && filters.departmentIds.length > 0) {
        return Boolean(
          movement.employee?.department_id &&
            filters.departmentIds.includes(movement.employee.department_id),
        );
      }

      return !filters.departmentId || movement.employee?.department_id === filters.departmentId;
    });
}

export async function getEmployeeMovementById(movementId: ID) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_movements")
    .select(movementSelect)
    .eq("id", movementId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return sortMovementItems(data as unknown as EmployeeMovement);
}

export async function listEmployeeMovementsWithSummary(filters: EmployeeMovementFilters = {}) {
  const movements = await listEmployeeMovements(filters);

  return {
    movements,
    summary: summarizeMovements(movements),
  };
}

export async function createEmployeeMovement(input: EmployeeMovementInput) {
  validateMovementInput(input);

  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const items = normalizeMovementItems(input.cost_items);
  const totalAmount = calculateMovementTotal(items);
  let employeeId = input.employee_id;

  if (input.movement_type === "admission" && !employeeId) {
    const employee = await createEmployeeForAdmission(
      input.admission_employee,
      input.movement_date,
      user.data.user?.id,
    );
    employeeId = employee.id;
  }

  if (!employeeId) {
    throw new Error("Selecione o colaborador.");
  }

  if (input.movement_type === "termination" && input.status !== "cancelled") {
    await assertNoExistingActiveTermination(employeeId);
  }

  const payload = {
    employee_id: employeeId,
    movement_type: input.movement_type,
    movement_date: input.movement_date,
    reference_month: referenceMonthFromDate(input.movement_date),
    termination_reason_id:
      input.movement_type === "termination" ? (cleanString(input.termination_reason_id) as ID | null) : null,
    status: input.status,
    notes: cleanString(input.notes),
    total_amount: totalAmount,
    created_by: user.data.user?.id,
    updated_by: user.data.user?.id,
  };

  const { data, error } = await supabase
    .from("employee_movements")
    .insert(payload)
    .select(movementSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const movement = data as unknown as EmployeeMovement;
  await replaceMovementItems(movement.id, items, user.data.user?.id);
  const created = await getEmployeeMovementById(movement.id);
  await syncEmployeeFromMovement(created, user.data.user?.id);

  await createAuditLog({
    action: `employee_movement.${input.movement_type}.created`,
    entity: "employee_movements",
    entity_id: created.id,
    new_value: created,
  });

  await createEmployeeHistoryEvent({
    employee_id: created.employee_id,
    event_type: input.movement_type,
    title: `${movementLabel(input.movement_type)} registrada`,
    description: `${movementLabel(input.movement_type)} registrada em ${input.movement_date}.`,
    source_entity: "employee_movements",
    source_entity_id: created.id,
  });

  return created;
}

export async function updateEmployeeMovement(movementId: ID, input: EmployeeMovementInput) {
  validateMovementInput(input);

  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const before = await getEmployeeMovementById(movementId);
  const items = normalizeMovementItems(input.cost_items);
  const totalAmount = calculateMovementTotal(items);
  const employeeId = input.employee_id;

  if (!employeeId) {
    throw new Error("Selecione o colaborador.");
  }

  if (input.movement_type === "termination" && input.status !== "cancelled") {
    await assertNoExistingActiveTermination(employeeId, movementId);
  }

  const { data, error } = await supabase
    .from("employee_movements")
    .update({
      employee_id: employeeId,
      movement_type: input.movement_type,
      movement_date: input.movement_date,
      reference_month: referenceMonthFromDate(input.movement_date),
      termination_reason_id:
        input.movement_type === "termination" ? (cleanString(input.termination_reason_id) as ID | null) : null,
      status: input.status,
      notes: cleanString(input.notes),
      total_amount: totalAmount,
      updated_by: user.data.user?.id,
    })
    .eq("id", movementId)
    .select(movementSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const movement = data as unknown as EmployeeMovement;
  await replaceMovementItems(movement.id, items, user.data.user?.id);
  const updated = await getEmployeeMovementById(movement.id);
  await syncEmployeeFromMovement(updated, user.data.user?.id);

  await createAuditLog({
    action: `employee_movement.${input.movement_type}.updated`,
    entity: "employee_movements",
    entity_id: movementId,
    old_value: before,
    new_value: updated,
  });

  await createEmployeeHistoryEvent({
    employee_id: updated.employee_id,
    event_type: input.movement_type,
    title: `${movementLabel(input.movement_type)} atualizada`,
    description: `${movementLabel(input.movement_type)} atualizada em ${input.movement_date}.`,
    source_entity: "employee_movements",
    source_entity_id: updated.id,
  });

  return updated;
}

export async function deleteEmployeeMovement(movementId: ID) {
  await ensureCurrentUserIsMaster();

  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const before = await getEmployeeMovementById(movementId);

  if (before.movement_type !== "termination") {
    throw new Error("Somente desligamentos podem ser excluídos por esta ação.");
  }

  const { error } = await supabase.from("employee_movements").delete().eq("id", movementId);

  if (error) {
    throw new Error(error.message);
  }

  await syncEmployeeFromLatestCompletedMovement(before.employee_id, user.data.user?.id);

  await createAuditLog({
    action: "employee_movement.termination.deleted",
    entity: "employee_movements",
    entity_id: movementId,
    old_value: before,
  });

  await createEmployeeHistoryEvent({
    employee_id: before.employee_id,
    event_type: "termination_deleted",
    title: "Desligamento excluído",
    description: `Desligamento de ${before.movement_date} excluído por usuário Master.`,
    source_entity: "employee_movements",
    source_entity_id: before.id,
  });

  return before;
}

export async function createEmployeeAdmissionMovementSeed(employee: Employee) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();

  const { error } = await supabase.from("employee_movements").insert({
    employee_id: employee.id,
    movement_type: "admission",
    movement_date: employee.hire_date,
    reference_month: referenceMonthFromDate(employee.hire_date),
    status: "completed",
    notes: "Registro criado automaticamente no cadastro do colaborador.",
    total_amount: 0,
    created_by: user.data.user?.id,
    updated_by: user.data.user?.id,
  });

  if (error && !isMissingMovementsTable(error)) {
    throw new Error(error.message);
  }
}
