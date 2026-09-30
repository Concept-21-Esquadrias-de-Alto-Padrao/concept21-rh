import { createAuditLog, createEmployeeHistoryEvent } from "@/modules/hr/services/audit.service";
import { ensureCurrentUserIsMaster } from "@/modules/hr/services/auth.service";
import { getEmployeeById, listEmployees, type EmployeeFilters } from "@/modules/hr/services/employees.service";
import { getHrSupabaseClient, slugifyKey } from "@/modules/hr/services/service-utils";
import type {
  CostAppliesTo,
  CostCalculationType,
  CostComponent,
  CostComponentCategory,
  Employee,
  EmployeeCompensation,
  EmployeeCostComponent,
  EmployeeMonthlyCostEvent,
  ID,
  MonthlyEmployeeCostItem,
  MonthlyCostEventSource,
  MonthlyCostEventStatus,
  MonthlyEmployeeCost,
  MonthlyEmployeeCostStatus,
} from "@/modules/hr/types";
import {
  calculateContractualHourCost,
  calculateCostComponent,
  calculateHourlyRate,
  calculateProductiveHourCost,
  calculateWorkedHourCost,
  countBusinessDays,
  formatReferenceMonth,
  getDefaultReferenceMonth,
  getMonthBounds,
  isDateWithinRange,
  normalizeReferenceMonth,
  roundMoney,
  requiresManualCostInput,
  toNumber,
  type CalculatedCostComponent,
} from "@/modules/hr/utils/labor-cost-calculations";

export interface CostComponentCategoryInput {
  name: string;
  key?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface CostComponentInput {
  category_id: ID;
  name: string;
  key?: string;
  description?: string | null;
  calculation_type: CostCalculationType;
  default_value?: number | string | null;
  default_percentage?: number | string | null;
  applies_to: CostAppliesTo;
  employment_type_id?: ID | null;
  department_id?: ID | null;
  position_id?: ID | null;
  adds_to_company_cost?: boolean;
  deducts_from_cost?: boolean;
  is_benefit?: boolean;
  is_employer_charge?: boolean;
  is_provision?: boolean;
  is_variable_event?: boolean;
  include_in_dashboard?: boolean;
  include_in_hour_cost?: boolean;
  show_on_employee_profile?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface EmployeeCompensationInput {
  employee_id: ID;
  base_salary: number | string;
  monthly_hours: number | string;
  employment_type_id?: ID | null;
  effective_from: string;
  effective_until?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface EmployeeCostComponentInput {
  employee_id: ID;
  cost_component_id: ID;
  calculation_type?: CostCalculationType | null;
  value?: number | string | null;
  percentage?: number | string | null;
  quantity?: number | string | null;
  effective_from: string;
  effective_until?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface MonthlyCostEventInput {
  employee_id: ID;
  reference_month: string;
  cost_component_id: ID;
  description: string;
  quantity?: number | string | null;
  unit_value?: number | string | null;
  total_value?: number | string | null;
  source?: MonthlyCostEventSource;
  status?: MonthlyCostEventStatus;
  notes?: string | null;
}

export interface MonthlyCostFilters extends EmployeeFilters {
  employeeId?: ID;
  employeeIds?: ID[];
  referenceMonth?: string;
  departmentId?: ID;
  positionId?: ID;
  employmentTypeId?: ID;
  statusId?: ID;
  closingStatus?: MonthlyEmployeeCostStatus | "";
}

export type EmployeeCostCopyMode = "replace" | "merge";

export interface CopyEmployeeCostSettingsOptions {
  copyCompensation?: boolean;
  copyMonthlyHours?: boolean;
  copyCostComponents?: boolean;
  copyBenefits?: boolean;
  copyAllowances?: boolean;
  copyChargesAndProvisions?: boolean;
  copyAttendanceRules?: boolean;
  copyNotes?: boolean;
  mode: EmployeeCostCopyMode;
  effectiveFrom: string;
}

export interface CopyEmployeeCostSettingsResult {
  compensationCreated: boolean;
  componentsCopied: number;
  componentsIgnored: number;
  componentsReplaced: number;
}

export interface EstimatedEmployeeMonthlyCost {
  employee: Employee;
  compensation: EmployeeCompensation | null;
  referenceMonth: string;
  referenceMonthLabel: string;
  businessDays: number;
  baseSalary: number;
  fixedCompensationTotal: number;
  benefitsTotal: number;
  allowancesTotal: number;
  employerChargesTotal: number;
  provisionsTotal: number;
  variableEventsTotal: number;
  reimbursementsTotal: number;
  deductionsTotal: number;
  totalCompanyCost: number;
  contractedHours: number | null;
  workedHours: number | null;
  productiveHours: number | null;
  contractualHourCost: number | null;
  workedHourCost: number | null;
  productiveHourCost: number | null;
  components: CalculatedCostComponent[];
  events: EmployeeMonthlyCostEvent[];
  savedMonthlyCost: MonthlyEmployeeCost | null;
}

export interface DepartmentLaborCost {
  departmentId: ID | null;
  departmentName: string;
  employeeCount: number;
  totalCompanyCost: number;
  baseSalaryTotal: number;
  benefitsAndAllowancesTotal: number;
  chargesAndProvisionsTotal: number;
  averageCostPerEmployee: number;
  averageContractualHourCost: number | null;
}

export interface EmployeeCostSummary {
  employeeId: ID;
  employeeName: string;
  employeeNumber: string;
  departmentName: string;
  positionName: string;
  employmentTypeName: string;
  statusName: string;
  totalCompanyCost: number;
  baseSalary: number;
  fixedCompensationTotal: number;
  benefitsTotal: number;
  allowancesTotal: number;
  employerChargesTotal: number;
  provisionsTotal: number;
  variableEventsTotal: number;
  reimbursementsTotal: number;
  deductionsTotal: number;
  contractualHourCost: number | null;
  workedHourCost: number | null;
  productiveHourCost: number | null;
  closingStatus?: MonthlyEmployeeCostStatus | null;
}

export interface LaborCostDashboard {
  referenceMonth: string;
  referenceMonthLabel: string;
  employeeCount: number;
  totalEstimatedCost: number;
  totalClosedCost: number;
  baseSalaryTotal: number;
  benefitsTotal: number;
  allowancesTotal: number;
  employerChargesTotal: number;
  provisionsTotal: number;
  variableEventsTotal: number;
  reimbursementsTotal: number;
  deductionsTotal: number;
  averageCostPerEmployee: number;
  averageContractualHourCost: number | null;
  averageWorkedHourCost: number | null;
  departmentCosts: DepartmentLaborCost[];
  employeeCosts: EmployeeCostSummary[];
  topEmployeesByCost: EmployeeCostSummary[];
  topEmployeesByHourCost: EmployeeCostSummary[];
}

export interface EmployeeLaborCostProfile {
  referenceMonth: string;
  summary: EstimatedEmployeeMonthlyCost;
  compensations: EmployeeCompensation[];
  employeeComponents: EmployeeCostComponent[];
  events: EmployeeMonthlyCostEvent[];
  monthlyCosts: MonthlyEmployeeCost[];
  costComponents: CostComponent[];
  categories: CostComponentCategory[];
  employees: Employee[];
}

const componentSelect = "*, category:cost_component_categories(*)";
const compensationSelect = "*, employment_type:employment_types(*)";
const employeeComponentSelect = "*, cost_component:cost_components(*, category:cost_component_categories(*))";
const eventSelect = "*, cost_component:cost_components(*, category:cost_component_categories(*))";
const monthlyCostSelect = "*, employee:employees(id, full_name, employee_number, department_id, department:departments(*))";

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numericOrNull(value: number | string | null | undefined) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function assertNonNegative(value: number | null, message: string) {
  if (value !== null && value < 0) {
    throw new Error(message);
  }
}

function assertPeriod(effectiveFrom: string, effectiveUntil?: string | null) {
  if (!effectiveFrom) {
    throw new Error("Data inicial de vigência é obrigatória.");
  }

  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    throw new Error("Data final de vigência não pode ser anterior à data inicial.");
  }
}

function dateBefore(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

async function currentUserId() {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  return user.data.user?.id ?? null;
}

async function safeAuditLog(input: Parameters<typeof createAuditLog>[0]) {
  try {
    await createAuditLog(input);
  } catch {
    // Auditoria não deve impedir a operação principal.
  }
}

function categoryKey(component?: CostComponent | null) {
  return component?.category?.key ?? "";
}

function isBenefitComponent(component?: CostComponent | null) {
  return Boolean(component?.is_benefit || categoryKey(component) === "beneficio");
}

function isAllowanceComponent(component?: CostComponent | null) {
  return categoryKey(component) === "ajuda_de_custo";
}

function isChargeOrProvisionComponent(component?: CostComponent | null) {
  const key = categoryKey(component);
  return Boolean(component?.is_employer_charge || component?.is_provision || key === "encargo" || key === "provisao");
}

function isAttendanceComponent(component?: CostComponent | null) {
  return component?.key === "premio_assiduidade";
}

function shouldCopyEmployeeComponent(component: EmployeeCostComponent, options: CopyEmployeeCostSettingsOptions) {
  const costComponent = component.cost_component;

  if (isBenefitComponent(costComponent)) {
    return options.copyBenefits ?? false;
  }

  if (isAllowanceComponent(costComponent)) {
    return options.copyAllowances ?? false;
  }

  if (isChargeOrProvisionComponent(costComponent)) {
    return options.copyChargesAndProvisions ?? false;
  }

  if (isAttendanceComponent(costComponent)) {
    return options.copyAttendanceRules ?? false;
  }

  return options.copyCostComponents ?? false;
}

function componentUnitValue(item: CalculatedCostComponent) {
  const calculationType = item.calculationType;
  const component = item.component;
  const employeeComponent = item.employeeComponent;

  if (["daily_value", "hourly_value", "fixed_monthly", "manual_monthly", "formula"].includes(calculationType)) {
    return toNumber(employeeComponent?.value ?? component.default_value ?? item.amount);
  }

  return null;
}

function componentPercentage(item: CalculatedCostComponent) {
  return item.employeeComponent?.percentage ?? item.component.default_percentage ?? null;
}

function monthlyCostItemsPayloadFromSummary(summary: EstimatedEmployeeMonthlyCost, monthlyEmployeeCostId: ID) {
  return summary.components.map((item) => ({
    monthly_employee_cost_id: monthlyEmployeeCostId,
    employee_id: summary.employee.id,
    cost_component_id: item.component.id,
    component_name_snapshot: item.component.name,
    category_name_snapshot: item.component.category?.name ?? null,
    calculation_type_snapshot: item.calculationType,
    quantity: item.quantity,
    unit_value: componentUnitValue(item),
    percentage: componentPercentage(item),
    total_value: item.amount,
  }));
}

function normalizeCompensationInput(input: EmployeeCompensationInput) {
  const baseSalary = numericOrNull(input.base_salary);
  const monthlyHours = numericOrNull(input.monthly_hours);

  if (!input.employee_id) {
    throw new Error("Colaborador é obrigatório.");
  }

  if (baseSalary === null) {
    throw new Error("Salário-base é obrigatório.");
  }

  if (monthlyHours === null || monthlyHours <= 0) {
    throw new Error("Jornada mensal deve ser maior que zero.");
  }

  assertNonNegative(baseSalary, "Salário-base não pode ser negativo.");
  assertPeriod(input.effective_from, input.effective_until);

  return {
    employee_id: input.employee_id,
    base_salary: baseSalary,
    monthly_hours: monthlyHours,
    hourly_base_rate: calculateHourlyRate(baseSalary, monthlyHours) ?? 0,
    employment_type_id: cleanText(input.employment_type_id ?? null),
    effective_from: input.effective_from,
    effective_until: cleanText(input.effective_until ?? null),
    notes: cleanText(input.notes),
    is_active: input.is_active ?? true,
  };
}

function normalizeEmployeeComponentInput(input: EmployeeCostComponentInput) {
  if (!input.employee_id || !input.cost_component_id) {
    throw new Error("Colaborador e componente são obrigatórios.");
  }

  assertPeriod(input.effective_from, input.effective_until);

  const value = numericOrNull(input.value);
  const percentage = numericOrNull(input.percentage);
  const quantity = numericOrNull(input.quantity);

  assertNonNegative(value, "Valor não pode ser negativo.");
  assertNonNegative(percentage, "Percentual não pode ser negativo.");
  assertNonNegative(quantity, "Quantidade não pode ser negativa.");

  return {
    employee_id: input.employee_id,
    cost_component_id: input.cost_component_id,
    calculation_type: input.calculation_type || null,
    value,
    percentage,
    quantity,
    effective_from: input.effective_from,
    effective_until: cleanText(input.effective_until ?? null),
    notes: cleanText(input.notes),
    is_active: input.is_active ?? true,
  };
}

function normalizeMonthlyEventInput(input: MonthlyCostEventInput) {
  if (!input.employee_id || !input.cost_component_id) {
    throw new Error("Colaborador e componente são obrigatórios.");
  }

  if (!input.description.trim()) {
    throw new Error("Descrição do evento é obrigatória.");
  }

  const quantity = numericOrNull(input.quantity) ?? 1;
  const unitValue = numericOrNull(input.unit_value) ?? 0;
  const informedTotal = numericOrNull(input.total_value);

  assertNonNegative(quantity, "Quantidade não pode ser negativa.");
  assertNonNegative(unitValue, "Valor unitário não pode ser negativo.");
  assertNonNegative(informedTotal, "Valor total não pode ser negativo.");

  return {
    employee_id: input.employee_id,
    reference_month: normalizeReferenceMonth(input.reference_month),
    cost_component_id: input.cost_component_id,
    description: input.description.trim(),
    quantity,
    unit_value: unitValue,
    total_value: informedTotal ?? roundMoney(quantity * unitValue),
    source: input.source ?? "manual",
    status: input.status ?? "pending",
    notes: cleanText(input.notes),
  };
}

function normalizeCostComponentInput(input: CostComponentInput) {
  if (!input.category_id || !input.name.trim()) {
    throw new Error("Categoria e nome são obrigatórios.");
  }

  const defaultValue = numericOrNull(input.default_value);
  const defaultPercentage = numericOrNull(input.default_percentage);

  assertNonNegative(defaultValue, "Valor padrão não pode ser negativo.");
  assertNonNegative(defaultPercentage, "Percentual padrão não pode ser negativo.");

  return {
    category_id: input.category_id,
    name: input.name.trim(),
    key: cleanText(input.key ?? null) ?? slugifyKey(input.name),
    description: cleanText(input.description),
    calculation_type: input.calculation_type,
    default_value: defaultValue,
    default_percentage: defaultPercentage,
    applies_to: input.applies_to,
    employment_type_id: cleanText(input.employment_type_id ?? null),
    department_id: cleanText(input.department_id ?? null),
    position_id: cleanText(input.position_id ?? null),
    adds_to_company_cost: input.adds_to_company_cost ?? true,
    deducts_from_cost: input.deducts_from_cost ?? false,
    is_benefit: input.is_benefit ?? false,
    is_employer_charge: input.is_employer_charge ?? false,
    is_provision: input.is_provision ?? false,
    is_variable_event: input.is_variable_event ?? false,
    include_in_dashboard: input.include_in_dashboard ?? true,
    include_in_hour_cost: input.include_in_hour_cost ?? true,
    show_on_employee_profile: input.show_on_employee_profile ?? true,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  };
}

export async function listCostComponentCategories(includeInactive = true) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("cost_component_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CostComponentCategory[];
}

export async function createCostComponentCategory(input: CostComponentCategoryInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = {
    name: input.name.trim(),
    key: cleanText(input.key ?? null) ?? slugifyKey(input.name),
    description: cleanText(input.description),
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
    created_by: userId,
    updated_by: userId,
  };

  if (!payload.name) {
    throw new Error("Nome é obrigatório.");
  }

  const { data, error } = await supabase
    .from("cost_component_categories")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.category.created",
    entity: "cost_component_categories",
    entity_id: data.id,
    new_value: data,
  });

  return data as CostComponentCategory;
}

export async function updateCostComponentCategory(id: ID, input: CostComponentCategoryInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = {
    name: input.name?.trim(),
    key: cleanText(input.key ?? null),
    description: cleanText(input.description),
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from("cost_component_categories")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.category.updated",
    entity: "cost_component_categories",
    entity_id: id,
    new_value: data,
  });

  return data as CostComponentCategory;
}

export async function inactivateCostComponentCategory(id: ID) {
  const supabase = getHrSupabaseClient();
  const { error } = await supabase.from("cost_component_categories").update({ is_active: false }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.category.inactivated",
    entity: "cost_component_categories",
    entity_id: id,
  });
}

export async function listCostComponents(filters: { includeInactive?: boolean; categoryId?: ID } = {}) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("cost_components")
    .select(componentSelect)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!filters.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as CostComponent[];
}

export async function createCostComponent(input: CostComponentInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = {
    ...normalizeCostComponentInput(input),
    created_by: userId,
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from("cost_components")
    .insert(payload)
    .select(componentSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.component.created",
    entity: "cost_components",
    entity_id: data.id,
    new_value: data,
  });

  return data as unknown as CostComponent;
}

export async function updateCostComponent(id: ID, input: CostComponentInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = {
    ...normalizeCostComponentInput(input),
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from("cost_components")
    .update(payload)
    .eq("id", id)
    .select(componentSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.component.updated",
    entity: "cost_components",
    entity_id: id,
    new_value: data,
  });

  return data as unknown as CostComponent;
}

export async function inactivateCostComponent(id: ID) {
  const supabase = getHrSupabaseClient();
  const { error } = await supabase.from("cost_components").update({ is_active: false }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.component.inactivated",
    entity: "cost_components",
    entity_id: id,
  });
}

export async function reactivateCostComponent(id: ID) {
  const supabase = getHrSupabaseClient();
  const { error } = await supabase.from("cost_components").update({ is_active: true }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listEmployeeCompensations(employeeId: ID) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_compensations")
    .select(compensationSelect)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("effective_from", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeCompensation[];
}

export async function getActiveEmployeeCompensation(employeeId: ID, referenceDate: string) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_compensations")
    .select(compensationSelect)
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .lte("effective_from", referenceDate)
    .or(`effective_until.is.null,effective_until.gte.${referenceDate}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as unknown as EmployeeCompensation | null;
}

export async function createEmployeeCompensation(input: EmployeeCompensationInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = normalizeCompensationInput(input);
  const previousUntil = dateBefore(payload.effective_from);

  await supabase
    .from("employee_compensations")
    .update({
      effective_until: previousUntil,
      updated_by: userId,
    })
    .eq("employee_id", payload.employee_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .is("effective_until", null)
    .lt("effective_from", payload.effective_from);

  const { data, error } = await supabase
    .from("employee_compensations")
    .insert({
      ...payload,
      created_by: userId,
      updated_by: userId,
    })
    .select(compensationSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.compensation.created",
    entity: "employee_compensations",
    entity_id: data.id,
    new_value: data,
  });

  await createEmployeeHistoryEvent({
    employee_id: payload.employee_id,
    event_type: "compensation_changed",
    title: "Remuneração registrada",
    description: `Salário-base gerencial de ${payload.base_salary.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })} vigente a partir de ${payload.effective_from}.`,
    source_entity: "employee_compensations",
    source_entity_id: data.id,
  });

  return data as unknown as EmployeeCompensation;
}

export async function updateEmployeeCompensation(id: ID, input: EmployeeCompensationInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = normalizeCompensationInput(input);

  const { data, error } = await supabase
    .from("employee_compensations")
    .update({
      ...payload,
      updated_by: userId,
    })
    .eq("id", id)
    .select(compensationSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.compensation.updated",
    entity: "employee_compensations",
    entity_id: id,
    new_value: data,
  });

  return data as unknown as EmployeeCompensation;
}

export async function inactivateEmployeeCompensation(id: ID) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("employee_compensations")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.compensation.inactivated",
    entity: "employee_compensations",
    entity_id: id,
    old_value: data,
  });
}

export async function listEmployeeCostComponents(employeeId: ID) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_cost_components")
    .select(employeeComponentSelect)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("effective_from", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeCostComponent[];
}

export async function addEmployeeCostComponent(input: EmployeeCostComponentInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = normalizeEmployeeComponentInput(input);

  const { data, error } = await supabase
    .from("employee_cost_components")
    .insert({
      ...payload,
      created_by: userId,
      updated_by: userId,
    })
    .select(employeeComponentSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.employee_component.created",
    entity: "employee_cost_components",
    entity_id: data.id,
    new_value: data,
  });

  return data as unknown as EmployeeCostComponent;
}

export async function updateEmployeeCostComponent(id: ID, input: EmployeeCostComponentInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = normalizeEmployeeComponentInput(input);

  const { data, error } = await supabase
    .from("employee_cost_components")
    .update({
      ...payload,
      updated_by: userId,
    })
    .eq("id", id)
    .select(employeeComponentSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.employee_component.updated",
    entity: "employee_cost_components",
    entity_id: id,
    new_value: data,
  });

  return data as unknown as EmployeeCostComponent;
}

export async function inactivateEmployeeCostComponent(id: ID) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("employee_cost_components")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.employee_component.inactivated",
    entity: "employee_cost_components",
    entity_id: id,
  });
}

export async function removeEmployeeCostComponent(id: ID) {
  await ensureCurrentUserIsMaster();

  const supabase = getHrSupabaseClient();
  const { data: current, error: currentError } = await supabase
    .from("employee_cost_components")
    .select(employeeComponentSelect)
    .eq("id", id)
    .single();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const { error } = await supabase.from("employee_cost_components").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.employee_component.removed",
    entity: "employee_cost_components",
    entity_id: id,
    old_value: current,
    metadata: {
      employee_id: current.employee_id,
      cost_component_id: current.cost_component_id,
    },
  });

  return current as unknown as EmployeeCostComponent;
}

export async function copyEmployeeCostSettings(
  sourceEmployeeId: ID,
  targetEmployeeId: ID,
  options: CopyEmployeeCostSettingsOptions,
): Promise<CopyEmployeeCostSettingsResult> {
  if (!sourceEmployeeId) {
    throw new Error("Colaborador de origem é obrigatório.");
  }

  if (!targetEmployeeId) {
    throw new Error("Colaborador de destino é obrigatório.");
  }

  if (sourceEmployeeId === targetEmployeeId) {
    throw new Error("Origem e destino não podem ser o mesmo colaborador.");
  }

  if (!["replace", "merge"].includes(options.mode)) {
    throw new Error("Modo de aplicação inválido.");
  }

  assertPeriod(options.effectiveFrom);

  const [sourceEmployee, targetEmployee, sourceCompensation, targetCompensation, sourceComponents, targetComponents] =
    await Promise.all([
      getEmployeeById(sourceEmployeeId),
      getEmployeeById(targetEmployeeId),
      getActiveEmployeeCompensation(sourceEmployeeId, options.effectiveFrom),
      getActiveEmployeeCompensation(targetEmployeeId, options.effectiveFrom),
      listEmployeeCostComponents(sourceEmployeeId),
      listEmployeeCostComponents(targetEmployeeId),
    ]);

  if (!targetEmployee.is_active) {
    throw new Error("Colaborador de destino precisa estar ativo.");
  }

  const result: CopyEmployeeCostSettingsResult = {
    compensationCreated: false,
    componentsCopied: 0,
    componentsIgnored: 0,
    componentsReplaced: 0,
  };
  const shouldCopyCompensation = Boolean(options.copyCompensation || options.copyMonthlyHours);

  if (shouldCopyCompensation && sourceCompensation) {
    if (!(options.mode === "merge" && targetCompensation)) {
      await createEmployeeCompensation({
        employee_id: targetEmployeeId,
        base_salary: options.copyCompensation
          ? sourceCompensation.base_salary
          : targetCompensation?.base_salary ?? sourceCompensation.base_salary,
        monthly_hours: options.copyMonthlyHours
          ? sourceCompensation.monthly_hours
          : targetCompensation?.monthly_hours ?? sourceCompensation.monthly_hours,
        employment_type_id: targetEmployee.employment_type_id ?? null,
        effective_from: options.effectiveFrom,
        effective_until: null,
        notes: options.copyNotes ? sourceCompensation.notes : null,
        is_active: true,
      });
      result.compensationCreated = true;
    }
  }

  const activeSourceComponents = sourceComponents.filter(
    (component) =>
      component.is_active &&
      isDateWithinRange(options.effectiveFrom, component.effective_from, component.effective_until) &&
      shouldCopyEmployeeComponent(component, options),
  );
  const activeTargetComponents = targetComponents.filter(
    (component) =>
      component.is_active &&
      isDateWithinRange(options.effectiveFrom, component.effective_from, component.effective_until) &&
      shouldCopyEmployeeComponent(component, options),
  );

  if (options.mode === "replace") {
    for (const targetComponent of activeTargetComponents) {
      await removeEmployeeCostComponent(targetComponent.id);
      result.componentsReplaced += 1;
    }
  }

  const targetComponentIds = new Set(
    (options.mode === "merge" ? activeTargetComponents : []).map((component) => component.cost_component_id),
  );

  for (const sourceComponent of activeSourceComponents) {
    if (targetComponentIds.has(sourceComponent.cost_component_id)) {
      result.componentsIgnored += 1;
      continue;
    }

    await addEmployeeCostComponent({
      employee_id: targetEmployeeId,
      cost_component_id: sourceComponent.cost_component_id,
      calculation_type: sourceComponent.calculation_type ?? null,
      value: sourceComponent.value ?? null,
      percentage: sourceComponent.percentage ?? null,
      quantity: sourceComponent.quantity ?? null,
      effective_from: options.effectiveFrom,
      effective_until: null,
      notes: options.copyNotes ? sourceComponent.notes : null,
      is_active: true,
    });
    result.componentsCopied += 1;
  }

  await safeAuditLog({
    action: "labor_cost.employee_settings.copied",
    entity: "employees",
    entity_id: targetEmployeeId,
    metadata: {
      source_employee_id: sourceEmployeeId,
      source_employee_name: sourceEmployee.full_name,
      target_employee_id: targetEmployeeId,
      target_employee_name: targetEmployee.full_name,
      mode: options.mode,
      effective_from: options.effectiveFrom,
      copy_compensation: Boolean(options.copyCompensation),
      copy_monthly_hours: Boolean(options.copyMonthlyHours),
      copy_cost_components: Boolean(options.copyCostComponents),
      copy_benefits: Boolean(options.copyBenefits),
      copy_allowances: Boolean(options.copyAllowances),
      copy_charges_and_provisions: Boolean(options.copyChargesAndProvisions),
      copy_attendance_rules: Boolean(options.copyAttendanceRules),
      copy_notes: Boolean(options.copyNotes),
      compensation_created: result.compensationCreated,
      components_copied: result.componentsCopied,
      components_ignored: result.componentsIgnored,
      components_replaced: result.componentsReplaced,
    },
  });

  await createEmployeeHistoryEvent({
    employee_id: targetEmployeeId,
    event_type: "labor_cost_settings_copied",
    title: "Configurações de custo copiadas",
    description: `Configurações copiadas de ${sourceEmployee.full_name} com vigência a partir de ${options.effectiveFrom}.`,
    source_entity: "employees",
    source_entity_id: sourceEmployeeId,
    metadata: {
      mode: options.mode,
      components_copied: result.componentsCopied,
      components_replaced: result.componentsReplaced,
      components_ignored: result.componentsIgnored,
    },
  });

  return result;
}

export async function listMonthlyCostEvents(filters: { employeeId?: ID; referenceMonth?: string } = {}) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_monthly_cost_events")
    .select(eventSelect)
    .is("deleted_at", null)
    .order("reference_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }

  if (filters.referenceMonth) {
    query = query.eq("reference_month", normalizeReferenceMonth(filters.referenceMonth));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeMonthlyCostEvent[];
}

export async function createMonthlyCostEvent(input: MonthlyCostEventInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = normalizeMonthlyEventInput(input);

  const { data, error } = await supabase
    .from("employee_monthly_cost_events")
    .insert({
      ...payload,
      created_by: userId,
      updated_by: userId,
    })
    .select(eventSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.monthly_event.created",
    entity: "employee_monthly_cost_events",
    entity_id: data.id,
    new_value: data,
  });

  return data as unknown as EmployeeMonthlyCostEvent;
}

export async function updateMonthlyCostEvent(id: ID, input: MonthlyCostEventInput) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = normalizeMonthlyEventInput(input);

  const { data, error } = await supabase
    .from("employee_monthly_cost_events")
    .update({
      ...payload,
      updated_by: userId,
    })
    .eq("id", id)
    .select(eventSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.monthly_event.updated",
    entity: "employee_monthly_cost_events",
    entity_id: id,
    new_value: data,
  });

  return data as unknown as EmployeeMonthlyCostEvent;
}

export async function cancelMonthlyCostEvent(id: ID) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("employee_monthly_cost_events")
    .update({
      status: "cancelled",
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.monthly_event.cancelled",
    entity: "employee_monthly_cost_events",
    entity_id: id,
  });
}

export async function listMonthlyEmployeeCosts(filters: { employeeId?: ID; referenceMonth?: string } = {}) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("monthly_employee_costs")
    .select(monthlyCostSelect)
    .order("reference_month", { ascending: false });

  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }

  if (filters.referenceMonth) {
    query = query.eq("reference_month", normalizeReferenceMonth(filters.referenceMonth));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as MonthlyEmployeeCost[];
}

async function getSavedMonthlyCost(employeeId: ID, referenceMonth: string) {
  const [saved] = await listMonthlyEmployeeCosts({ employeeId, referenceMonth });
  return saved ?? null;
}

function isComponentApplicableToEmployee(component: CostComponent, employee: Employee) {
  if (component.applies_to === "all_employees") {
    return true;
  }

  if (component.applies_to === "employment_type") {
    return Boolean(component.employment_type_id && component.employment_type_id === employee.employment_type_id);
  }

  if (component.applies_to === "department") {
    return Boolean(component.department_id && component.department_id === employee.department_id);
  }

  if (component.applies_to === "position") {
    return Boolean(component.position_id && component.position_id === employee.position_id);
  }

  return false;
}

function groupComponentTotals(components: CalculatedCostComponent[]) {
  const totals = {
    fixed: 0,
    benefits: 0,
    allowances: 0,
    charges: 0,
    provisions: 0,
    variableEvents: 0,
    deductions: 0,
    additionsForTotal: 0,
  };

  for (const item of components) {
    const component = item.component;
    const key = categoryKey(component);

    if (component.deducts_from_cost) {
      totals.deductions += item.amount;
      continue;
    }

    if (component.adds_to_company_cost) {
      totals.additionsForTotal += item.amount;
    }

    if (key === "remuneracao_fixa") {
      totals.fixed += item.amount;
    } else if (component.is_benefit || key === "beneficio") {
      totals.benefits += item.amount;
    } else if (key === "ajuda_de_custo") {
      totals.allowances += item.amount;
    } else if (component.is_employer_charge || key === "encargo") {
      totals.charges += item.amount;
    } else if (component.is_provision || key === "provisao") {
      totals.provisions += item.amount;
    } else if (component.is_variable_event || key === "evento_variavel") {
      totals.variableEvents += item.amount;
    }
  }

  return {
    fixed: roundMoney(totals.fixed),
    benefits: roundMoney(totals.benefits),
    allowances: roundMoney(totals.allowances),
    charges: roundMoney(totals.charges),
    provisions: roundMoney(totals.provisions),
    variableEvents: roundMoney(totals.variableEvents),
    deductions: roundMoney(totals.deductions),
    additionsForTotal: roundMoney(totals.additionsForTotal),
  };
}

function groupEventTotals(events: EmployeeMonthlyCostEvent[]) {
  const totals = {
    variableEvents: 0,
    reimbursements: 0,
    deductions: 0,
    additionsForTotal: 0,
  };

  for (const event of events) {
    const amount = roundMoney(toNumber(event.total_value));
    const component = event.cost_component;
    const key = categoryKey(component);

    if (component?.deducts_from_cost || key === "desconto") {
      totals.deductions += amount;
      continue;
    }

    if (component?.adds_to_company_cost !== false) {
      totals.additionsForTotal += amount;
    }

    if (key === "reembolso") {
      totals.reimbursements += amount;
    } else {
      totals.variableEvents += amount;
    }
  }

  return {
    variableEvents: roundMoney(totals.variableEvents),
    reimbursements: roundMoney(totals.reimbursements),
    deductions: roundMoney(totals.deductions),
    additionsForTotal: roundMoney(totals.additionsForTotal),
  };
}

export async function calculateEstimatedEmployeeMonthlyCost(
  employee: Employee,
  referenceMonth = getDefaultReferenceMonth(),
): Promise<EstimatedEmployeeMonthlyCost> {
  const normalizedReferenceMonth = normalizeReferenceMonth(referenceMonth);
  const { endDate } = getMonthBounds(normalizedReferenceMonth);
  const businessDays = countBusinessDays(normalizedReferenceMonth);
  const [compensation, employeeComponents, events, savedMonthlyCost, allComponents] = await Promise.all([
    getActiveEmployeeCompensation(employee.id, endDate),
    listEmployeeCostComponents(employee.id),
    listMonthlyCostEvents({ employeeId: employee.id, referenceMonth: normalizedReferenceMonth }),
    getSavedMonthlyCost(employee.id, normalizedReferenceMonth),
    listCostComponents({ includeInactive: false }),
  ]);

  const baseSalary = toNumber(compensation?.base_salary);
  const monthlyHours = toNumber(compensation?.monthly_hours);
  const activeEmployeeComponents = employeeComponents.filter(
    (component) =>
      component.is_active &&
      isDateWithinRange(
        normalizedReferenceMonth,
        component.effective_from,
        component.effective_until,
      ),
  );
  const employeeComponentByComponentId = new Map(
    activeEmployeeComponents.map((component) => [component.cost_component_id, component]),
  );
  const applicableComponents = allComponents
    .filter((component) => component.key !== "salario_base")
    .filter((component) => !requiresManualCostInput(component))
    .filter((component) => {
      if (employeeComponentByComponentId.has(component.id)) {
        return false;
      }

      return isComponentApplicableToEmployee(component, employee);
    });
  const employeeSpecificComponents = activeEmployeeComponents
    .map((component) => component.cost_component)
    .filter(Boolean) as CostComponent[];
  const componentsToCalculate = [...applicableComponents, ...employeeSpecificComponents].filter(
    (component) => component.is_active && component.show_on_employee_profile,
  );
  const calculatedComponents = componentsToCalculate.map((component) =>
    calculateCostComponent({
      baseSalary,
      monthlyHours,
      businessDays,
      component,
      employeeComponent: employeeComponentByComponentId.get(component.id) ?? null,
    }),
  );
  const includedEvents = events.filter(
    (event) => event.is_active && !["ignored", "cancelled"].includes(event.status),
  );
  const componentTotals = groupComponentTotals(calculatedComponents);
  const eventTotals = groupEventTotals(includedEvents);
  const deductionsTotal = roundMoney(componentTotals.deductions + eventTotals.deductions);
  const totalCompanyCost = roundMoney(
    baseSalary +
      componentTotals.additionsForTotal +
      eventTotals.additionsForTotal -
      deductionsTotal,
  );
  const contractedHours = monthlyHours > 0 ? monthlyHours : null;
  const workedHours = contractedHours;
  const productiveHours = null;

  return {
    employee,
    compensation,
    referenceMonth: normalizedReferenceMonth,
    referenceMonthLabel: formatReferenceMonth(normalizedReferenceMonth),
    businessDays,
    baseSalary,
    fixedCompensationTotal: roundMoney(baseSalary + componentTotals.fixed),
    benefitsTotal: componentTotals.benefits,
    allowancesTotal: componentTotals.allowances,
    employerChargesTotal: componentTotals.charges,
    provisionsTotal: componentTotals.provisions,
    variableEventsTotal: roundMoney(componentTotals.variableEvents + eventTotals.variableEvents),
    reimbursementsTotal: eventTotals.reimbursements,
    deductionsTotal,
    totalCompanyCost,
    contractedHours,
    workedHours,
    productiveHours,
    contractualHourCost: calculateContractualHourCost(totalCompanyCost, contractedHours),
    workedHourCost: calculateWorkedHourCost(totalCompanyCost, workedHours),
    productiveHourCost: calculateProductiveHourCost(totalCompanyCost, productiveHours),
    components: calculatedComponents,
    events: includedEvents,
    savedMonthlyCost,
  };
}

function monthlyCostPayloadFromSummary(summary: EstimatedEmployeeMonthlyCost) {
  return {
    employee_id: summary.employee.id,
    reference_month: summary.referenceMonth,
    base_salary: summary.baseSalary,
    fixed_compensation_total: summary.fixedCompensationTotal,
    benefits_total: summary.benefitsTotal,
    allowances_total: summary.allowancesTotal,
    employer_charges_total: summary.employerChargesTotal,
    provisions_total: summary.provisionsTotal,
    variable_events_total: summary.variableEventsTotal,
    reimbursements_total: summary.reimbursementsTotal,
    deductions_total: summary.deductionsTotal,
    total_company_cost: summary.totalCompanyCost,
    contracted_hours: summary.contractedHours,
    worked_hours: summary.workedHours,
    productive_hours: summary.productiveHours,
    contractual_hour_cost: summary.contractualHourCost,
    worked_hour_cost: summary.workedHourCost,
    productive_hour_cost: summary.productiveHourCost,
    status: "estimated" as MonthlyEmployeeCostStatus,
    calculated_at: new Date().toISOString(),
  };
}

export async function saveMonthlyEmployeeCost(summary: EstimatedEmployeeMonthlyCost, notes?: string | null) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const payload = {
    ...monthlyCostPayloadFromSummary(summary),
    notes: cleanText(notes),
    updated_by: userId,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from("monthly_employee_costs")
    .upsert(payload, { onConflict: "employee_id,reference_month" })
    .select(monthlyCostSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const items: Array<Partial<MonthlyEmployeeCostItem>> = monthlyCostItemsPayloadFromSummary(summary, data.id);
  const { error: deleteItemsError } = await supabase
    .from("monthly_employee_cost_items")
    .delete()
    .eq("monthly_employee_cost_id", data.id);

  if (deleteItemsError) {
    throw new Error(deleteItemsError.message);
  }

  if (items.length > 0) {
    const { error: insertItemsError } = await supabase.from("monthly_employee_cost_items").insert(items);

    if (insertItemsError) {
      throw new Error(insertItemsError.message);
    }
  }

  await safeAuditLog({
    action: "labor_cost.monthly_cost.calculated",
    entity: "monthly_employee_costs",
    entity_id: data.id,
    new_value: data,
  });

  return data as unknown as MonthlyEmployeeCost;
}

export async function closeMonthlyEmployeeCost(id: ID) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("monthly_employee_costs")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: userId,
      updated_by: userId,
    })
    .eq("id", id)
    .select(monthlyCostSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.monthly_cost.closed",
    entity: "monthly_employee_costs",
    entity_id: id,
    new_value: data,
  });

  return data as unknown as MonthlyEmployeeCost;
}

export async function reopenMonthlyEmployeeCost(id: ID) {
  const supabase = getHrSupabaseClient();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("monthly_employee_costs")
    .update({
      status: "reopened",
      closed_at: null,
      closed_by: null,
      updated_by: userId,
    })
    .eq("id", id)
    .select(monthlyCostSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await safeAuditLog({
    action: "labor_cost.monthly_cost.reopened",
    entity: "monthly_employee_costs",
    entity_id: id,
    new_value: data,
  });

  return data as unknown as MonthlyEmployeeCost;
}

export async function getEmployeeLaborCostProfile(employee: Employee, referenceMonth = getDefaultReferenceMonth()) {
  const normalizedReferenceMonth = normalizeReferenceMonth(referenceMonth);
  const [summary, compensations, employeeComponents, events, monthlyCosts, costComponents, categories, employees] =
    await Promise.all([
      calculateEstimatedEmployeeMonthlyCost(employee, normalizedReferenceMonth),
      listEmployeeCompensations(employee.id),
      listEmployeeCostComponents(employee.id),
      listMonthlyCostEvents({ employeeId: employee.id, referenceMonth: normalizedReferenceMonth }),
      listMonthlyEmployeeCosts({ employeeId: employee.id }),
      listCostComponents({ includeInactive: false }),
      listCostComponentCategories(false),
      listEmployees(),
    ]);

  return {
    referenceMonth: normalizedReferenceMonth,
    summary,
    compensations,
    employeeComponents,
    events,
    monthlyCosts,
    costComponents,
    categories,
    employees,
  } satisfies EmployeeLaborCostProfile;
}

export async function calculateAllEmployeesMonthlyCost(
  referenceMonth = getDefaultReferenceMonth(),
  filters: MonthlyCostFilters = {},
) {
  const employees = await listEmployees({
    search: filters.search,
    departmentId: filters.departmentId,
    departmentIds: filters.departmentIds,
    positionId: filters.positionId,
    positionIds: filters.positionIds,
    employmentTypeId: filters.employmentTypeId,
    employmentTypeIds: filters.employmentTypeIds,
    statusId: filters.statusId,
    statusIds: filters.statusIds,
  });
  const employeeIds = Array.from(new Set(filters.employeeIds?.filter(Boolean) ?? []));
  const filteredEmployees =
    employeeIds.length > 0
      ? employees.filter((employee) => employeeIds.includes(employee.id))
      : filters.employeeId
        ? employees.filter((employee) => employee.id === filters.employeeId)
        : employees;

  return Promise.all(
    filteredEmployees.map((employee) => calculateEstimatedEmployeeMonthlyCost(employee, referenceMonth)),
  );
}

function departmentName(employee: Employee) {
  return employee.department?.name ?? "Sem departamento";
}

function toEmployeeCostSummary(summary: EstimatedEmployeeMonthlyCost): EmployeeCostSummary {
  return {
    employeeId: summary.employee.id,
    employeeName: summary.employee.full_name,
    employeeNumber: summary.employee.employee_number,
    departmentName: departmentName(summary.employee),
    positionName: summary.employee.position?.name ?? "-",
    employmentTypeName: summary.employee.employment_type?.name ?? "-",
    statusName: summary.employee.status?.name ?? "-",
    totalCompanyCost: summary.totalCompanyCost,
    baseSalary: summary.baseSalary,
    fixedCompensationTotal: summary.fixedCompensationTotal,
    benefitsTotal: summary.benefitsTotal,
    allowancesTotal: summary.allowancesTotal,
    employerChargesTotal: summary.employerChargesTotal,
    provisionsTotal: summary.provisionsTotal,
    variableEventsTotal: summary.variableEventsTotal,
    reimbursementsTotal: summary.reimbursementsTotal,
    deductionsTotal: summary.deductionsTotal,
    contractualHourCost: summary.contractualHourCost,
    workedHourCost: summary.workedHourCost,
    productiveHourCost: summary.productiveHourCost,
    closingStatus: summary.savedMonthlyCost?.status ?? null,
  };
}

type DepartmentLaborCostAccumulator = DepartmentLaborCost & {
  contractedHours: number;
};

function buildDepartmentLaborCosts(summaries: EstimatedEmployeeMonthlyCost[]) {
  const byDepartment = new Map<string, DepartmentLaborCostAccumulator>();

  for (const summary of summaries) {
    const key = summary.employee.department_id ?? "none";
    const current =
      byDepartment.get(key) ??
      ({
        departmentId: summary.employee.department_id ?? null,
        departmentName: departmentName(summary.employee),
        employeeCount: 0,
        totalCompanyCost: 0,
        baseSalaryTotal: 0,
        benefitsAndAllowancesTotal: 0,
        chargesAndProvisionsTotal: 0,
        averageCostPerEmployee: 0,
        averageContractualHourCost: null,
        contractedHours: 0,
      } satisfies DepartmentLaborCostAccumulator);

    current.employeeCount += 1;
    current.totalCompanyCost += summary.totalCompanyCost;
    current.baseSalaryTotal += summary.baseSalary;
    current.benefitsAndAllowancesTotal += summary.benefitsTotal + summary.allowancesTotal;
    current.chargesAndProvisionsTotal += summary.employerChargesTotal + summary.provisionsTotal;
    current.contractedHours += toNumber(summary.contractedHours);
    byDepartment.set(key, current);
  }

  return Array.from(byDepartment.values())
    .map((item) => ({
      departmentId: item.departmentId,
      departmentName: item.departmentName,
      employeeCount: item.employeeCount,
      totalCompanyCost: roundMoney(item.totalCompanyCost),
      baseSalaryTotal: roundMoney(item.baseSalaryTotal),
      benefitsAndAllowancesTotal: roundMoney(item.benefitsAndAllowancesTotal),
      chargesAndProvisionsTotal: roundMoney(item.chargesAndProvisionsTotal),
      averageCostPerEmployee:
        item.employeeCount > 0 ? roundMoney(item.totalCompanyCost / item.employeeCount) : 0,
      averageContractualHourCost: calculateContractualHourCost(
        item.totalCompanyCost,
        item.contractedHours,
      ),
    }))
    .sort((first, second) => second.totalCompanyCost - first.totalCompanyCost);
}

export async function getDepartmentLaborCosts(referenceMonth = getDefaultReferenceMonth(), filters: MonthlyCostFilters = {}) {
  const summaries = await calculateAllEmployeesMonthlyCost(referenceMonth, filters);
  return buildDepartmentLaborCosts(summaries);
}

export async function getTopEmployeeCosts(referenceMonth = getDefaultReferenceMonth(), filters: MonthlyCostFilters = {}) {
  const summaries = await calculateAllEmployeesMonthlyCost(referenceMonth, filters);

  return summaries
    .map(toEmployeeCostSummary)
    .sort((first, second) => second.totalCompanyCost - first.totalCompanyCost)
    .slice(0, 8);
}

export async function getLaborCostDashboard(
  referenceMonth = getDefaultReferenceMonth(),
  filters: MonthlyCostFilters = {},
): Promise<LaborCostDashboard> {
  const normalizedReferenceMonth = normalizeReferenceMonth(referenceMonth);
  const summaries = await calculateAllEmployeesMonthlyCost(normalizedReferenceMonth, filters);
  const closedCosts = await listMonthlyEmployeeCosts({ referenceMonth: normalizedReferenceMonth });
  const totalEstimatedCost = roundMoney(
    summaries.reduce((total, summary) => total + summary.totalCompanyCost, 0),
  );
  const contractedHours = summaries.reduce((total, summary) => total + toNumber(summary.contractedHours), 0);
  const workedHours = summaries.reduce((total, summary) => total + toNumber(summary.workedHours), 0);
  const employeeCount = summaries.length;
  const departmentCosts = buildDepartmentLaborCosts(summaries);
  const employeeSummaries = summaries.map(toEmployeeCostSummary);
  const employeesByCost = [...employeeSummaries].sort(
    (first, second) => second.totalCompanyCost - first.totalCompanyCost,
  );
  const employeesByHourCost = [...employeeSummaries]
    .filter((item) => item.contractualHourCost !== null)
    .sort((first, second) => toNumber(second.contractualHourCost) - toNumber(first.contractualHourCost));

  return {
    referenceMonth: normalizedReferenceMonth,
    referenceMonthLabel: formatReferenceMonth(normalizedReferenceMonth),
    employeeCount,
    totalEstimatedCost,
    totalClosedCost: roundMoney(
      closedCosts
        .filter((cost) => cost.status === "closed")
        .reduce((total, cost) => total + toNumber(cost.total_company_cost), 0),
    ),
    baseSalaryTotal: roundMoney(summaries.reduce((total, summary) => total + summary.baseSalary, 0)),
    benefitsTotal: roundMoney(summaries.reduce((total, summary) => total + summary.benefitsTotal, 0)),
    allowancesTotal: roundMoney(summaries.reduce((total, summary) => total + summary.allowancesTotal, 0)),
    employerChargesTotal: roundMoney(
      summaries.reduce((total, summary) => total + summary.employerChargesTotal, 0),
    ),
    provisionsTotal: roundMoney(summaries.reduce((total, summary) => total + summary.provisionsTotal, 0)),
    variableEventsTotal: roundMoney(
      summaries.reduce((total, summary) => total + summary.variableEventsTotal, 0),
    ),
    reimbursementsTotal: roundMoney(
      summaries.reduce((total, summary) => total + summary.reimbursementsTotal, 0),
    ),
    deductionsTotal: roundMoney(summaries.reduce((total, summary) => total + summary.deductionsTotal, 0)),
    averageCostPerEmployee: employeeCount > 0 ? roundMoney(totalEstimatedCost / employeeCount) : 0,
    averageContractualHourCost: calculateContractualHourCost(totalEstimatedCost, contractedHours),
    averageWorkedHourCost: calculateWorkedHourCost(totalEstimatedCost, workedHours),
    departmentCosts,
    employeeCosts: employeesByCost,
    topEmployeesByCost: employeesByCost.slice(0, 8),
    topEmployeesByHourCost: employeesByHourCost.slice(0, 8),
  };
}
