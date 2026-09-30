import {
  getLaborCostDashboard,
  type DepartmentLaborCost,
  type EmployeeCostSummary,
  type LaborCostDashboard,
} from "@/modules/hr/services/labor-costs.service";
import { getCurrentUserAccess } from "@/modules/hr/services/auth.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type { Department, EmployeeStatus, EmploymentType, ID } from "@/modules/hr/types";
import {
  formatCurrencyBRL,
  getDefaultReferenceMonth,
  normalizeReferenceMonth,
  roundMoney,
  toNumber,
} from "@/modules/hr/utils/labor-cost-calculations";
import {
  calculateAverageHeadcount,
  calculateTerminationTurnoverRate,
  calculateTurnoverRate,
  getTurnoverStatus,
  type TurnoverStatus,
} from "@/modules/hr/utils/turnover-calculations";
import {
  isAbsenceOccurrenceType,
  isDayImpactingOccurrenceType,
  isMedicalCertificateOccurrenceType,
} from "@/modules/hr/utils/occurrences";

export type DashboardScope = "general" | "competence";

export interface HrDashboardFilters {
  scope?: DashboardScope;
  referenceMonth?: string;
  departmentId?: string;
  departmentIds?: string[];
  employmentTypeId?: string;
  employmentTypeIds?: string[];
  statusId?: string;
  statusIds?: string[];
  evolutionMonths?: number;
}

export interface HrDashboardOptionSet {
  departments: Department[];
  employmentTypes: EmploymentType[];
  statuses: EmployeeStatus[];
}

export interface HrDashboardChartItem {
  label: string;
  value: number;
  detail?: string;
  color?: string;
}

export interface HrDashboardGroupedChartItem {
  label: string;
  [key: string]: string | number;
}

export interface TurnoverSnapshot {
  referenceMonth: string;
  label: string;
  admissions: number;
  terminations: number;
  activeAtStart: number;
  activeAtEnd: number;
  averageHeadcount: number;
  turnoverRate: number;
  terminationTurnoverRate: number;
  status: TurnoverStatus;
}

export interface HrDashboardSummary {
  activeEmployees: number;
  averageHeadcount: number;
  admissions: number;
  terminations: number;
  turnoverRate: number;
  terminationTurnoverRate: number;
  turnoverStatus: TurnoverStatus;
  turnoverVariationPp: number | null;
  payrollTotal: number | null;
  averageCostPerEmployee: number | null;
  expiredDocuments: number;
  expiringDocuments: number;
  expiredTrainings: number;
  expiringTrainings: number;
  periodVacations: number;
  activeLeaves: number;
  occurrencesTotal: number;
  occurrenceImpactedDays: number;
  punishmentOccurrences: number;
  averageOccurrencesPerEmployee: number;
  averageOccurrencesPerDepartment: number;
}

export interface HrDashboardAlerts {
  expiredDocuments: Array<{ id: string; employee: string; document: string; expirationDate: string }>;
  expiringDocuments: Array<{ id: string; employee: string; document: string; expirationDate: string }>;
  upcomingBirthdays: Array<{ id: string; name: string; birthDate: string }>;
  periodVacations: Array<{ id: string; employee: string; start: string; end: string; status: string }>;
  activeLeaves: Array<{ id: string; employee: string; start: string; end?: string | null }>;
  expiringTrainings: Array<{ id: string; employee: string; training: string; expirationDate: string }>;
}

export interface HrDashboardCosts {
  dashboard: LaborCostDashboard;
  composition: HrDashboardChartItem[];
  byDepartment: HrDashboardChartItem[];
  topEmployeesByCost: HrDashboardChartItem[];
  topEmployeesByHourCost: HrDashboardChartItem[];
  departmentCosts: DepartmentLaborCost[];
  employeeCosts: EmployeeCostSummary[];
}

export interface HrDashboardOccurrenceRankingRow {
  label: string;
  detail?: string;
  count: number;
  impactedDays: number;
  topType?: string;
  involvedEmployees?: number;
  percentage?: number;
}

export interface HrDashboardOccurrenceAnalytics {
  total: number;
  impactedDays: number;
  punishmentCount: number;
  averagePerEmployee: number;
  averagePerDepartment: number;
  topEmployee?: HrDashboardOccurrenceRankingRow | null;
  topDepartment?: HrDashboardOccurrenceRankingRow | null;
  topType?: HrDashboardOccurrenceRankingRow | null;
  topCategory?: HrDashboardOccurrenceRankingRow | null;
  topPunishment?: HrDashboardOccurrenceRankingRow | null;
  employeesRanking: HrDashboardOccurrenceRankingRow[];
  departmentsRanking: HrDashboardOccurrenceRankingRow[];
  typesRanking: HrDashboardOccurrenceRankingRow[];
  categoriesComposition: HrDashboardChartItem[];
  impactedDaysByType: HrDashboardChartItem[];
}

export interface HrDashboardPermissions {
  canViewCosts: boolean;
  canViewOccurrenceRankings: boolean;
  canViewOccurrenceSensitive: boolean;
  costsHiddenReason?: string;
  occurrenceRankingsHiddenReason?: string;
  occurrenceSensitiveHiddenReason?: string;
}

export type HrDashboardCoreSummary = Pick<
  HrDashboardSummary,
  | "activeEmployees"
  | "averageHeadcount"
  | "admissions"
  | "terminations"
  | "turnoverRate"
  | "terminationTurnoverRate"
  | "turnoverStatus"
  | "turnoverVariationPp"
>;

export interface HrDashboardCoreData {
  scope: DashboardScope;
  scopeLabel: string;
  scopeDescription: string;
  referenceMonth: string;
  referenceMonthInput: string;
  periodLabel: string;
  options: HrDashboardOptionSet;
  permissions: HrDashboardPermissions;
  summary: HrDashboardCoreSummary;
  turnover: {
    current: TurnoverSnapshot;
    previous: TurnoverSnapshot;
    evolution: HrDashboardChartItem[];
    admissionsVsTerminations: HrDashboardGroupedChartItem[];
    byDepartment: HrDashboardChartItem[];
  };
  employeesByDepartment: HrDashboardChartItem[];
}

export interface HrDashboardOccurrencesData {
  summary: Pick<
    HrDashboardSummary,
    | "occurrencesTotal"
    | "occurrenceImpactedDays"
    | "punishmentOccurrences"
    | "averageOccurrencesPerEmployee"
    | "averageOccurrencesPerDepartment"
  >;
  evolution: HrDashboardGroupedChartItem[];
  byType: HrDashboardChartItem[];
  topDepartments: HrDashboardChartItem[];
  analytics: HrDashboardOccurrenceAnalytics;
}

export interface HrDashboardAlertsData {
  summary: Pick<
    HrDashboardSummary,
    | "expiredDocuments"
    | "expiringDocuments"
    | "expiredTrainings"
    | "expiringTrainings"
    | "periodVacations"
    | "activeLeaves"
  >;
  alerts: HrDashboardAlerts;
}

export interface HrDashboardData {
  scope: DashboardScope;
  scopeLabel: string;
  scopeDescription: string;
  referenceMonth: string;
  referenceMonthInput: string;
  periodLabel: string;
  options: HrDashboardOptionSet;
  permissions: HrDashboardPermissions;
  summary: HrDashboardSummary;
  turnover: {
    current: TurnoverSnapshot;
    previous: TurnoverSnapshot;
    evolution: HrDashboardChartItem[];
    admissionsVsTerminations: HrDashboardGroupedChartItem[];
    byDepartment: HrDashboardChartItem[];
  };
  costs: HrDashboardCosts | null;
  employeesByDepartment: HrDashboardChartItem[];
  occurrences: {
    evolution: HrDashboardGroupedChartItem[];
    byType: HrDashboardChartItem[];
    topDepartments: HrDashboardChartItem[];
    analytics: HrDashboardOccurrenceAnalytics;
  };
  alerts: HrDashboardAlerts;
}

interface DashboardEmployeeRow {
  id: ID;
  full_name: string;
  employee_number?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  department_id?: ID | null;
  employment_type_id?: ID | null;
  status_id?: ID | null;
  department?: { id?: ID | null; name?: string | null } | null;
  status?: { id?: ID | null; key?: string | null; name?: string | null; is_terminal?: boolean | null } | null;
}

interface RelatedEmployeeRow {
  id?: ID | null;
  full_name?: string | null;
  department_id?: ID | null;
  employment_type_id?: ID | null;
  status_id?: ID | null;
}

interface DashboardDocumentRow {
  id: ID;
  expiration_date?: string | null;
  status: string;
  employee?: RelatedEmployeeRow | null;
  document_type?: { name?: string | null } | null;
}

interface DashboardVacationRow {
  id: ID;
  vacation_start: string;
  vacation_end: string;
  status: string;
  employee?: RelatedEmployeeRow | null;
}

interface DashboardLeaveRow {
  id: ID;
  start_date: string;
  end_date?: string | null;
  status: string;
  employee?: RelatedEmployeeRow | null;
}

interface DashboardTrainingRow {
  id: ID;
  expiration_date?: string | null;
  status: string;
  employee?: RelatedEmployeeRow | null;
  training?: { name?: string | null } | null;
}

interface DashboardOccurrenceRow {
  id: ID;
  occurred_at: string;
  start_date?: string | null;
  end_date?: string | null;
  total_days?: number | null;
  department_id?: ID | null;
  employee?: (RelatedEmployeeRow & {
    employee_number?: string | null;
    department?: { id?: ID | null; name?: string | null } | null;
  }) | null;
  department?: { id?: ID | null; name?: string | null } | null;
  occurrence_type?: {
    id?: ID | null;
    name?: string | null;
    key?: string | null;
    counts_as_absence?: boolean | null;
    counts_as_medical_certificate?: boolean | null;
    is_punishment?: boolean | null;
    punishment_level?: string | null;
    occurrence_category?: { id?: ID | null; name?: string | null } | null;
  } | null;
  occurrence_category?: { id?: ID | null; name?: string | null } | null;
}

interface DashboardContext {
  scope: DashboardScope;
  isCompetenceScope: boolean;
  referenceMonth: string;
  referenceMonthInput: string;
  monthSequence: string[];
  firstMonthBounds: ReturnType<typeof getMonthBounds>;
  currentMonthBounds: ReturnType<typeof getMonthBounds>;
  previousMonth: string;
  today: string;
  soon: string;
}

const COST_COLORS = ["#171a1f", "#f97316", "#fb923c", "#71717a", "#a1a1aa", "#0f766e"];
const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function isoDateFromParts(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function getMonthBounds(referenceMonth: string) {
  const normalized = normalizeReferenceMonth(referenceMonth);
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));

  return {
    startDate: isoDateFromParts(year, month, 1),
    endDate: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

function shiftMonth(referenceMonth: string, offset: number) {
  const normalized = normalizeReferenceMonth(referenceMonth);
  const year = Number(normalized.slice(0, 4));
  const monthIndex = Number(normalized.slice(5, 7)) - 1 + offset;
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
}

function getMonthSequence(referenceMonth: string, count: number) {
  const safeCount = Math.max(1, Math.min(12, Math.trunc(count || 6)));

  return Array.from({ length: safeCount }, (_, index) =>
    shiftMonth(referenceMonth, index - safeCount + 1),
  );
}

function formatMonthLabel(referenceMonth: string) {
  const normalized = normalizeReferenceMonth(referenceMonth);
  const date = new Date(Date.UTC(Number(normalized.slice(0, 4)), Number(normalized.slice(5, 7)) - 1, 1));
  return monthLabelFormatter.format(date).replace(".", "");
}

function isDateInRange(value: string | null | undefined, startDate: string, endDate: string) {
  if (!value) {
    return false;
  }

  const date = value.slice(0, 10);
  return date >= startDate && date <= endDate;
}

function inclusiveDays(startDate?: string | null, endDate?: string | null) {
  if (!startDate) {
    return 0;
  }

  if (!endDate) {
    return 1;
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
    return 0;
  }

  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

function getOccurrenceImpactedDays(occurrence: DashboardOccurrenceRow) {
  if (!isDayImpactingOccurrenceType(occurrence.occurrence_type)) {
    return 0;
  }

  if (occurrence.total_days && occurrence.total_days > 0) {
    return occurrence.total_days;
  }

  const startDate = occurrence.start_date ?? occurrence.occurred_at?.slice(0, 10);
  return inclusiveDays(startDate, occurrence.end_date ?? startDate);
}

function getFirstHistoricalMonth(employees: DashboardEmployeeRow[], fallback: string) {
  const dates = employees
    .map((employee) => employee.hire_date)
    .filter(Boolean)
    .sort();
  return normalizeReferenceMonth(dates[0] ?? fallback);
}

function getMonthSequenceBetween(startMonth: string, endMonth: string, maxMonths = 120) {
  const start = normalizeReferenceMonth(startMonth);
  const end = normalizeReferenceMonth(endMonth);
  const sequence: string[] = [];
  let current = start;

  while (current <= end && sequence.length < maxMonths) {
    sequence.push(current);
    current = shiftMonth(current, 1);
  }

  return sequence.length > 0 ? sequence : [end];
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildDashboardContext(filters: HrDashboardFilters): DashboardContext {
  const scope: DashboardScope = filters.scope ?? (filters.referenceMonth ? "competence" : "general");
  const isCompetenceScope = scope === "competence";
  const referenceMonth = normalizeReferenceMonth(filters.referenceMonth ?? getDefaultReferenceMonth());
  const referenceMonthInput = referenceMonth.slice(0, 7);
  const monthCount = filters.evolutionMonths ?? (isCompetenceScope ? 6 : 12);
  const monthSequence = getMonthSequence(referenceMonth, monthCount);
  const firstMonthBounds = getMonthBounds(monthSequence[0] ?? referenceMonth);
  const currentMonthBounds = getMonthBounds(referenceMonth);
  const previousMonth = shiftMonth(referenceMonth, -1);
  const today = new Date().toISOString().slice(0, 10);
  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 30);

  return {
    scope,
    isCompetenceScope,
    referenceMonth,
    referenceMonthInput,
    monthSequence,
    firstMonthBounds,
    currentMonthBounds,
    previousMonth,
    today,
    soon: soonDate.toISOString().slice(0, 10),
  };
}

function isTerminalEmployee(employee: DashboardEmployeeRow) {
  const key = employee.status?.key ?? "";
  return Boolean(employee.status?.is_terminal) || ["inativo", "desligado"].includes(key);
}

function isActiveOnDate(employee: DashboardEmployeeRow, date: string) {
  if (!employee.hire_date || employee.hire_date > date) {
    return false;
  }

  if (employee.termination_date && employee.termination_date <= date) {
    return false;
  }

  if (!employee.termination_date && isTerminalEmployee(employee)) {
    return false;
  }

  return true;
}

function matchesRelatedEmployeeFilters(employee: RelatedEmployeeRow | null | undefined, filters: HrDashboardFilters) {
  if (!employee) {
    return false;
  }

  if (filters.departmentIds && filters.departmentIds.length > 0) {
    if (!employee.department_id || !filters.departmentIds.includes(employee.department_id)) {
      return false;
    }
  } else if (filters.departmentId && employee.department_id !== filters.departmentId) {
    return false;
  }

  if (filters.employmentTypeIds && filters.employmentTypeIds.length > 0) {
    if (!employee.employment_type_id || !filters.employmentTypeIds.includes(employee.employment_type_id)) {
      return false;
    }
  } else if (filters.employmentTypeId && employee.employment_type_id !== filters.employmentTypeId) {
    return false;
  }

  if (filters.statusIds && filters.statusIds.length > 0) {
    if (!employee.status_id || !filters.statusIds.includes(employee.status_id)) {
      return false;
    }
  } else if (filters.statusId && employee.status_id !== filters.statusId) {
    return false;
  }

  return true;
}

function turnoverForMonth(
  employees: DashboardEmployeeRow[],
  referenceMonth: string,
  fallbackActiveCount?: number,
): TurnoverSnapshot {
  const { startDate, endDate } = getMonthBounds(referenceMonth);
  const admissions = employees.filter((employee) => isDateInRange(employee.hire_date, startDate, endDate)).length;
  const terminations = employees.filter((employee) =>
    isDateInRange(employee.termination_date, startDate, endDate),
  ).length;
  const activeAtStart = employees.filter((employee) => isActiveOnDate(employee, startDate)).length;
  const activeAtEnd = employees.filter((employee) => isActiveOnDate(employee, endDate)).length;
  const calculatedAverageHeadcount = calculateAverageHeadcount(activeAtStart, activeAtEnd);
  // If historical dates are incomplete, keep the dashboard usable by falling back to current active headcount.
  const averageHeadcount =
    calculatedAverageHeadcount > 0 ? calculatedAverageHeadcount : Math.max(0, fallbackActiveCount ?? 0);
  const turnoverRate = calculateTurnoverRate(admissions, terminations, averageHeadcount);
  const terminationTurnoverRate = calculateTerminationTurnoverRate(terminations, averageHeadcount);

  return {
    referenceMonth: normalizeReferenceMonth(referenceMonth),
    label: formatMonthLabel(referenceMonth),
    admissions,
    terminations,
    activeAtStart,
    activeAtEnd,
    averageHeadcount,
    turnoverRate,
    terminationTurnoverRate,
    status: getTurnoverStatus(turnoverRate),
  };
}

function groupByDepartment(employees: DashboardEmployeeRow[], referenceMonth: string) {
  const { endDate } = getMonthBounds(referenceMonth);
  const groups = new Map<string, { label: string; value: number }>();

  for (const employee of employees) {
    if (!isActiveOnDate(employee, endDate)) {
      continue;
    }

    const id = employee.department_id ?? "sem_departamento";
    const label = employee.department?.name ?? "Sem departamento";
    const current = groups.get(id) ?? { label, value: 0 };
    current.value += 1;
    groups.set(id, current);
  }

  return Array.from(groups.values()).sort((first, second) => second.value - first.value);
}

function turnoverByDepartment(employees: DashboardEmployeeRow[], referenceMonth: string) {
  const groups = new Map<string, { label: string; employees: DashboardEmployeeRow[] }>();

  for (const employee of employees) {
    const id = employee.department_id ?? "sem_departamento";
    const current = groups.get(id) ?? {
      label: employee.department?.name ?? "Sem departamento",
      employees: [],
    };
    current.employees.push(employee);
    groups.set(id, current);
  }

  return Array.from(groups.values())
    .map((group) => {
      const activeAtEnd = group.employees.filter((employee) =>
        isActiveOnDate(employee, getMonthBounds(referenceMonth).endDate),
      ).length;
      const snapshot = turnoverForMonth(group.employees, referenceMonth, activeAtEnd);
      return {
        label: group.label,
        value: snapshot.turnoverRate,
        detail: `${snapshot.admissions} adm. / ${snapshot.terminations} desl.`,
      };
    })
    .filter((item) => item.value > 0)
    .sort((first, second) => second.value - first.value)
    .slice(0, 6);
}

async function checkPermission(permissionKey: string) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase.rpc("has_permission", { permission_key: permissionKey });

  if (error) {
    return false;
  }

  return Boolean(data);
}

async function loadDashboardPermissions(): Promise<HrDashboardPermissions> {
  const [
    currentAccess,
    canViewDashboardCosts,
    canViewSensitiveCosts,
    canViewLaborDashboard,
    canViewOccurrenceRankingsPermission,
    canViewOccurrenceSensitivePermission,
  ] = await Promise.all([
    getCurrentUserAccess(),
    checkPermission("hr.dashboard.costs.view"),
    checkPermission("hr.labor_costs.view_sensitive_values"),
    checkPermission("hr.labor_costs.dashboard"),
    checkPermission("hr.dashboard.occurrences.rankings"),
    checkPermission("hr.dashboard.occurrences.sensitive"),
  ]);
  const isMaster = currentAccess?.roles.some((role) => role.key === "master") ?? false;
  const canViewCosts = isMaster || (canViewSensitiveCosts && (canViewDashboardCosts || canViewLaborDashboard));
  const canViewOccurrenceRankings = isMaster || canViewOccurrenceRankingsPermission;
  const canViewOccurrenceSensitive = isMaster || canViewOccurrenceSensitivePermission;

  return {
    canViewCosts,
    canViewOccurrenceRankings,
    canViewOccurrenceSensitive,
    costsHiddenReason: canViewCosts
      ? undefined
      : "Custos de folha ocultos pelas permissões sensíveis de custos de mão de obra.",
    occurrenceRankingsHiddenReason: canViewOccurrenceRankings
      ? undefined
      : "Rankings de ocorrências ocultos pelas permissões do dashboard.",
    occurrenceSensitiveHiddenReason: canViewOccurrenceSensitive
      ? undefined
      : "Dados nominais de colaboradores ocultos pela permissão sensível de ocorrências.",
  };
}

async function loadOptions(): Promise<HrDashboardOptionSet> {
  const supabase = getHrSupabaseClient();
  const [departmentsResult, employmentTypesResult, statusesResult] = await Promise.all([
    supabase.from("departments").select("*").order("sort_order", { ascending: true }).order("name"),
    supabase.from("employment_types").select("*").order("sort_order", { ascending: true }).order("name"),
    supabase.from("employee_statuses").select("*").order("sort_order", { ascending: true }).order("name"),
  ]);
  const firstError = departmentsResult.error ?? employmentTypesResult.error ?? statusesResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    departments: (departmentsResult.data ?? []) as Department[],
    employmentTypes: (employmentTypesResult.data ?? []) as EmploymentType[],
    statuses: (statusesResult.data ?? []) as EmployeeStatus[],
  };
}

async function loadEmployees(filters: HrDashboardFilters) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employees")
    .select(
      `
      id,
      full_name,
      employee_number,
      birth_date,
      hire_date,
      termination_date,
      department_id,
      employment_type_id,
      status_id,
      department:departments(id, name),
      status:employee_statuses(id, key, name, is_terminal)
    `,
    )
    .is("deleted_at", null);

  if (filters.departmentIds && filters.departmentIds.length > 0) {
    query = query.in("department_id", Array.from(new Set(filters.departmentIds)));
  } else if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }

  if (filters.employmentTypeIds && filters.employmentTypeIds.length > 0) {
    query = query.in("employment_type_id", Array.from(new Set(filters.employmentTypeIds)));
  } else if (filters.employmentTypeId) {
    query = query.eq("employment_type_id", filters.employmentTypeId);
  }

  if (filters.statusIds && filters.statusIds.length > 0) {
    query = query.in("status_id", Array.from(new Set(filters.statusIds)));
  } else if (filters.statusId) {
    query = query.eq("status_id", filters.statusId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as DashboardEmployeeRow[];
}

async function loadAlerts(
  filters: HrDashboardFilters,
  today: string,
  soon: string,
  periodStart: string,
  periodEnd: string,
): Promise<HrDashboardAlerts & {
  expiredDocumentsCount: number;
  expiringDocumentsCount: number;
  expiredTrainingsCount: number;
  expiringTrainingsCount: number;
  periodVacationsCount: number;
  activeLeavesCount: number;
}> {
  const supabase = getHrSupabaseClient();
  const [documentsResult, vacationsResult, leavesResult, trainingsResult] = await Promise.all([
    supabase
      .from("employee_documents")
      .select("id, expiration_date, status, employee:employees(id, full_name, department_id, employment_type_id, status_id), document_type:document_types(name)")
      .is("deleted_at", null),
    supabase
      .from("vacations")
      .select("id, vacation_start, vacation_end, status, employee:employees(id, full_name, department_id, employment_type_id, status_id)")
      .is("deleted_at", null),
    supabase
      .from("employee_leaves")
      .select("id, start_date, end_date, status, employee:employees(id, full_name, department_id, employment_type_id, status_id)")
      .is("deleted_at", null),
    supabase
      .from("employee_trainings")
      .select("id, expiration_date, status, employee:employees(id, full_name, department_id, employment_type_id, status_id), training:trainings(name)")
      .is("deleted_at", null),
  ]);
  const firstError = documentsResult.error ?? vacationsResult.error ?? leavesResult.error ?? trainingsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const documents = ((documentsResult.data ?? []) as unknown as DashboardDocumentRow[]).filter((item) =>
    matchesRelatedEmployeeFilters(item.employee, filters),
  );
  const vacations = ((vacationsResult.data ?? []) as unknown as DashboardVacationRow[]).filter((item) =>
    matchesRelatedEmployeeFilters(item.employee, filters),
  );
  const leaves = ((leavesResult.data ?? []) as unknown as DashboardLeaveRow[]).filter((item) =>
    matchesRelatedEmployeeFilters(item.employee, filters),
  );
  const trainings = ((trainingsResult.data ?? []) as unknown as DashboardTrainingRow[]).filter((item) =>
    matchesRelatedEmployeeFilters(item.employee, filters),
  );

  const expiredDocuments = documents.filter((document) => document.expiration_date && document.expiration_date < today);
  const expiringDocuments = documents.filter(
    (document) => document.expiration_date && document.expiration_date >= today && document.expiration_date <= soon,
  );
  const expiredTrainings = trainings.filter((training) => training.expiration_date && training.expiration_date < today);
  const expiringTrainings = trainings.filter(
    (training) => training.expiration_date && training.expiration_date >= today && training.expiration_date <= soon,
  );
  const periodVacations = vacations.filter(
    (vacation) =>
      ["requested", "approved", "in_progress"].includes(vacation.status) &&
      vacation.vacation_start <= periodEnd &&
      vacation.vacation_end >= periodStart,
  );
  const activeLeaves = leaves.filter(
    (leave) =>
      ["approved", "in_progress"].includes(leave.status) &&
      leave.start_date <= today &&
      (!leave.end_date || leave.end_date >= today),
  );

  return {
    expiredDocumentsCount: expiredDocuments.length,
    expiringDocumentsCount: expiringDocuments.length,
    expiredTrainingsCount: expiredTrainings.length,
    expiringTrainingsCount: expiringTrainings.length,
    periodVacationsCount: periodVacations.length,
    activeLeavesCount: activeLeaves.length,
    expiredDocuments: expiredDocuments.slice(0, 6).map((document) => ({
      id: document.id,
      employee: document.employee?.full_name ?? "-",
      document: document.document_type?.name ?? "-",
      expirationDate: document.expiration_date ?? "",
    })),
    expiringDocuments: expiringDocuments.slice(0, 6).map((document) => ({
      id: document.id,
      employee: document.employee?.full_name ?? "-",
      document: document.document_type?.name ?? "-",
      expirationDate: document.expiration_date ?? "",
    })),
    periodVacations: periodVacations.slice(0, 6).map((vacation) => ({
      id: vacation.id,
      employee: vacation.employee?.full_name ?? "-",
      start: vacation.vacation_start,
      end: vacation.vacation_end,
      status: vacation.status,
    })),
    activeLeaves: activeLeaves.slice(0, 6).map((leave) => ({
      id: leave.id,
      employee: leave.employee?.full_name ?? "-",
      start: leave.start_date,
      end: leave.end_date,
    })),
    expiringTrainings: expiringTrainings.slice(0, 6).map((training) => ({
      id: training.id,
      employee: training.employee?.full_name ?? "-",
      training: training.training?.name ?? "-",
      expirationDate: training.expiration_date ?? "",
    })),
    upcomingBirthdays: [],
  };
}

async function loadOccurrences(rangeStart: string | null, rangeEnd: string | null, filters: HrDashboardFilters) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_occurrences")
    .select(
      `
      id,
      occurred_at,
      start_date,
      end_date,
      total_days,
      department_id,
      department:departments(id, name),
      employee:employees(id, full_name, employee_number, department_id, employment_type_id, status_id, department:departments(id, name)),
      occurrence_type:occurrence_types(id, name, key, counts_as_absence, counts_as_medical_certificate, is_punishment, punishment_level, occurrence_category:occurrence_categories(id, name)),
      occurrence_category:occurrence_categories(id, name)
    `,
    )
    .is("deleted_at", null);

  if (rangeStart) {
    query = query.gte("occurred_at", `${rangeStart}T00:00:00`);
  }

  if (rangeEnd) {
    query = query.lte("occurred_at", `${rangeEnd}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as DashboardOccurrenceRow[]).filter((occurrence) =>
    matchesRelatedEmployeeFilters(occurrence.employee, filters),
  );
}

function isAbsenceOccurrence(occurrence: DashboardOccurrenceRow) {
  return isAbsenceOccurrenceType(occurrence.occurrence_type);
}

function isMedicalCertificateOccurrence(occurrence: DashboardOccurrenceRow) {
  return isMedicalCertificateOccurrenceType(occurrence.occurrence_type);
}

function buildOccurrenceEvolution(occurrences: DashboardOccurrenceRow[], months: string[]) {
  return months.map((month) => {
    const { startDate, endDate } = getMonthBounds(month);
    const monthOccurrences = occurrences.filter((occurrence) =>
      isDateInRange(occurrence.occurred_at, startDate, endDate),
    );

    return {
      label: formatMonthLabel(month),
      ocorrencias: monthOccurrences.length,
      faltas: monthOccurrences.filter(isAbsenceOccurrence).length,
      atestados: monthOccurrences.filter(isMedicalCertificateOccurrence).length,
    };
  });
}

function buildOccurrencesByType(occurrences: DashboardOccurrenceRow[], referenceMonth?: string) {
  const bounds = referenceMonth ? getMonthBounds(referenceMonth) : null;
  const groups = new Map<string, HrDashboardChartItem>();

  for (const occurrence of occurrences) {
    if (bounds && !isDateInRange(occurrence.occurred_at, bounds.startDate, bounds.endDate)) {
      continue;
    }

    const label = occurrence.occurrence_type?.name ?? "Sem tipo";
    const current = groups.get(label) ?? { label, value: 0 };
    current.value += 1;
    groups.set(label, current);
  }

  return Array.from(groups.values())
    .sort((first, second) => second.value - first.value)
    .slice(0, 7);
}

function buildOccurrenceDepartments(occurrences: DashboardOccurrenceRow[], referenceMonth?: string) {
  const bounds = referenceMonth ? getMonthBounds(referenceMonth) : null;
  const groups = new Map<string, HrDashboardChartItem>();

  for (const occurrence of occurrences) {
    if (bounds && !isDateInRange(occurrence.occurred_at, bounds.startDate, bounds.endDate)) {
      continue;
    }

    const label =
      occurrence.department?.name ??
      occurrence.employee?.department?.name ??
      "Sem departamento";
    const current = groups.get(label) ?? { label, value: 0 };
    current.value += 1;
    groups.set(label, current);
  }

  return Array.from(groups.values())
    .sort((first, second) => second.value - first.value)
    .slice(0, 6);
}

interface OccurrenceAggregate {
  label: string;
  detail?: string;
  count: number;
  impactedDays: number;
  types: Map<string, number>;
  employees: Set<string>;
}

function createOccurrenceAggregate(label: string, detail?: string): OccurrenceAggregate {
  return {
    label,
    detail,
    count: 0,
    impactedDays: 0,
    types: new Map(),
    employees: new Set(),
  };
}

function addOccurrenceToAggregate(group: OccurrenceAggregate, occurrence: DashboardOccurrenceRow) {
  const type = occurrence.occurrence_type?.name ?? "Sem tipo";
  group.count += 1;
  group.impactedDays += getOccurrenceImpactedDays(occurrence);
  group.types.set(type, (group.types.get(type) ?? 0) + 1);

  if (occurrence.employee?.id) {
    group.employees.add(occurrence.employee.id);
  }
}

function getTopMapLabel(map: Map<string, number>) {
  return Array.from(map.entries()).sort((first, second) => second[1] - first[1])[0]?.[0];
}

function aggregateToRankingRow(group: OccurrenceAggregate, total: number): HrDashboardOccurrenceRankingRow {
  return {
    label: group.label,
    detail: group.detail,
    count: group.count,
    impactedDays: group.impactedDays,
    topType: getTopMapLabel(group.types),
    involvedEmployees: group.employees.size || undefined,
    percentage: total > 0 ? roundMoney((group.count / total) * 100) : 0,
  };
}

function sortOccurrenceRanking(groups: OccurrenceAggregate[], total: number, limit: number) {
  return groups
    .map((group) => aggregateToRankingRow(group, total))
    .sort((first, second) => second.count - first.count || second.impactedDays - first.impactedDays)
    .slice(0, limit);
}

function buildOccurrenceAnalytics(
  occurrences: DashboardOccurrenceRow[],
  employees: DashboardEmployeeRow[],
  options: { includeEmployeeDetails?: boolean; includeRankings?: boolean } = {},
): HrDashboardOccurrenceAnalytics {
  const includeEmployeeDetails = options.includeEmployeeDetails ?? true;
  const includeRankings = options.includeRankings ?? true;
  const total = occurrences.length;
  const totalEmployees = Math.max(1, employees.length);
  const departmentIds = new Set(employees.map((employee) => employee.department_id ?? "sem_departamento"));
  const totalDepartments = Math.max(1, departmentIds.size);
  const employeeGroups = new Map<string, OccurrenceAggregate>();
  const departmentGroups = new Map<string, OccurrenceAggregate>();
  const typeGroups = new Map<string, OccurrenceAggregate>();
  const categoryGroups = new Map<string, OccurrenceAggregate>();
  const punishmentGroups = new Map<string, OccurrenceAggregate>();
  let impactedDays = 0;
  let punishmentCount = 0;

  for (const occurrence of occurrences) {
    const occurrenceDays = getOccurrenceImpactedDays(occurrence);
    impactedDays += occurrenceDays;

    if (includeEmployeeDetails) {
      const employeeId = occurrence.employee?.id ?? "sem_colaborador";
      const employeeLabel = occurrence.employee?.full_name ?? "Sem colaborador";
      const employeeDepartment = occurrence.employee?.department?.name ?? occurrence.department?.name ?? "Sem departamento";
      const employeeGroup = employeeGroups.get(employeeId) ?? createOccurrenceAggregate(employeeLabel, employeeDepartment);
      addOccurrenceToAggregate(employeeGroup, occurrence);
      employeeGroups.set(employeeId, employeeGroup);
    }

    const departmentId = occurrence.department_id ?? occurrence.employee?.department_id ?? "sem_departamento";
    const departmentLabel = occurrence.department?.name ?? occurrence.employee?.department?.name ?? "Sem departamento";
    const departmentGroup = departmentGroups.get(departmentId) ?? createOccurrenceAggregate(departmentLabel);
    addOccurrenceToAggregate(departmentGroup, occurrence);
    departmentGroups.set(departmentId, departmentGroup);

    const typeId = occurrence.occurrence_type?.id ?? "sem_tipo";
    const typeLabel = occurrence.occurrence_type?.name ?? "Sem tipo";
    const typeGroup = typeGroups.get(typeId) ?? createOccurrenceAggregate(typeLabel);
    addOccurrenceToAggregate(typeGroup, occurrence);
    typeGroups.set(typeId, typeGroup);

    const categoryId =
      occurrence.occurrence_category?.id ??
      occurrence.occurrence_type?.occurrence_category?.id ??
      "sem_categoria";
    const categoryLabel =
      occurrence.occurrence_category?.name ??
      occurrence.occurrence_type?.occurrence_category?.name ??
      "Sem categoria";
    const categoryGroup = categoryGroups.get(categoryId) ?? createOccurrenceAggregate(categoryLabel);
    addOccurrenceToAggregate(categoryGroup, occurrence);
    categoryGroups.set(categoryId, categoryGroup);

    if (occurrence.occurrence_type?.is_punishment) {
      punishmentCount += 1;
      const punishmentKey = occurrence.occurrence_type.punishment_level ?? typeLabel;
      const punishmentGroup = punishmentGroups.get(punishmentKey) ?? createOccurrenceAggregate(typeLabel);
      addOccurrenceToAggregate(punishmentGroup, occurrence);
      punishmentGroups.set(punishmentKey, punishmentGroup);
    }
  }

  const employeesRanking = includeEmployeeDetails
    ? sortOccurrenceRanking(Array.from(employeeGroups.values()), total, 8)
    : [];
  const departmentsRanking = sortOccurrenceRanking(Array.from(departmentGroups.values()), total, 8);
  const typesRanking = sortOccurrenceRanking(Array.from(typeGroups.values()), total, 8);
  const categoryRanking = sortOccurrenceRanking(Array.from(categoryGroups.values()), total, 8);
  const punishmentRanking = sortOccurrenceRanking(Array.from(punishmentGroups.values()), punishmentCount, 5);

  return {
    total,
    impactedDays,
    punishmentCount,
    averagePerEmployee: roundMoney(total / totalEmployees),
    averagePerDepartment: roundMoney(total / totalDepartments),
    topEmployee: employeesRanking[0] ?? null,
    topDepartment: departmentsRanking[0] ?? null,
    topType: typesRanking[0] ?? null,
    topCategory: categoryRanking[0] ?? null,
    topPunishment: punishmentRanking[0] ?? null,
    employeesRanking: includeRankings ? employeesRanking : [],
    departmentsRanking: includeRankings ? departmentsRanking : [],
    typesRanking: includeRankings ? typesRanking : [],
    categoriesComposition: categoryRanking.map((item, index) => ({
      label: item.label,
      value: item.count,
      detail: `${item.percentage ?? 0}%`,
      color: COST_COLORS[index % COST_COLORS.length],
    })),
    impactedDaysByType: typesRanking
      .map((item) => ({
        label: item.label,
        value: item.impactedDays,
        detail: `${item.count} ocorrência(s)`,
      }))
      .filter((item) => item.value > 0),
  };
}

function buildCostComposition(dashboard: LaborCostDashboard): HrDashboardChartItem[] {
  return [
    { label: "Salarios-base", value: dashboard.baseSalaryTotal, color: COST_COLORS[0] },
    { label: "Beneficios", value: dashboard.benefitsTotal, color: COST_COLORS[1] },
    { label: "Ajudas", value: dashboard.allowancesTotal, color: COST_COLORS[2] },
    { label: "Encargos", value: dashboard.employerChargesTotal, color: COST_COLORS[3] },
    { label: "Provisoes", value: dashboard.provisionsTotal, color: COST_COLORS[4] },
    { label: "Eventos variaveis", value: dashboard.variableEventsTotal, color: COST_COLORS[5] },
  ].filter((item) => item.value > 0);
}

function buildCostPayload(dashboard: LaborCostDashboard): HrDashboardCosts {
  return {
    dashboard,
    composition: buildCostComposition(dashboard),
    byDepartment: dashboard.departmentCosts
      .map((department) => ({
        label: department.departmentName,
        value: department.totalCompanyCost,
        detail: `${department.employeeCount} colaborador(es)`,
      }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 8),
    topEmployeesByCost: dashboard.topEmployeesByCost.map((employee) => ({
      label: employee.employeeName,
      detail: employee.departmentName,
      value: employee.totalCompanyCost,
    })),
    topEmployeesByHourCost: dashboard.topEmployeesByHourCost.map((employee) => ({
      label: employee.employeeName,
      detail: employee.departmentName,
      value: toNumber(employee.contractualHourCost),
    })),
    departmentCosts: dashboard.departmentCosts,
    employeeCosts: dashboard.topEmployeesByCost,
  };
}

function buildUpcomingBirthdays(employees: DashboardEmployeeRow[], referenceMonth: string) {
  return employees
    .filter((employee) => {
      if (!employee.birth_date) {
        return false;
      }

      return Number(employee.birth_date.slice(5, 7)) === Number(referenceMonth.slice(5, 7));
    })
    .map((employee) => ({
      id: employee.id,
      name: employee.full_name,
      birthDate: employee.birth_date ?? "",
    }))
    .slice(0, 8);
}

function buildDashboardCorePayload(
  employees: DashboardEmployeeRow[],
  options: HrDashboardOptionSet,
  permissions: HrDashboardPermissions,
  context: DashboardContext,
): HrDashboardCoreData {
  const activeReferenceDate = context.isCompetenceScope ? context.currentMonthBounds.endDate : context.today;
  const activeAtEnd = employees.filter((employee) => isActiveOnDate(employee, activeReferenceDate)).length;
  const historicalMonthSequence = getMonthSequenceBetween(
    getFirstHistoricalMonth(employees, context.referenceMonth),
    context.referenceMonth,
  );
  const historicalTurnover = historicalMonthSequence.map((month) => turnoverForMonth(employees, month, activeAtEnd));
  const totalAdmissions = employees.filter((employee) => employee.hire_date).length;
  const totalTerminations = employees.filter((employee) => employee.termination_date).length;
  const averageHistoricalHeadcount = Math.round(average(historicalTurnover.map((item) => item.averageHeadcount)));
  const averageHistoricalTurnover = average(historicalTurnover.map((item) => item.turnoverRate));
  const averageHistoricalTerminationTurnover = average(historicalTurnover.map((item) => item.terminationTurnoverRate));
  const currentTurnover = context.isCompetenceScope
    ? turnoverForMonth(employees, context.referenceMonth, activeAtEnd)
    : {
        referenceMonth: context.referenceMonth,
        label: "Historico",
        admissions: totalAdmissions,
        terminations: totalTerminations,
        activeAtStart: historicalTurnover[0]?.activeAtStart ?? activeAtEnd,
        activeAtEnd,
        averageHeadcount: averageHistoricalHeadcount,
        turnoverRate: averageHistoricalTurnover,
        terminationTurnoverRate: averageHistoricalTerminationTurnover,
        status: getTurnoverStatus(averageHistoricalTurnover),
      };
  const previousTurnover = turnoverForMonth(employees, context.previousMonth, activeAtEnd);
  const turnoverVariationPp = context.isCompetenceScope
    ? roundMoney(currentTurnover.turnoverRate - previousTurnover.turnoverRate)
    : null;
  const turnoverEvolution = context.monthSequence.map((month) => turnoverForMonth(employees, month, activeAtEnd));

  return {
    scope: context.scope,
    scopeLabel: context.isCompetenceScope
      ? `Competencia: ${formatMonthLabel(context.referenceMonth)}/${context.referenceMonth.slice(0, 4)}`
      : "Visão geral",
    scopeDescription: context.isCompetenceScope
      ? `Dados da competência ${context.currentMonthBounds.startDate.slice(8, 10)}/${context.currentMonthBounds.startDate.slice(5, 7)} a ${context.currentMonthBounds.endDate.slice(8, 10)}/${context.currentMonthBounds.endDate.slice(5, 7)}.`
      : "Dados históricos consolidados desde o início dos registros.",
    referenceMonth: context.referenceMonth,
    referenceMonthInput: context.referenceMonthInput,
    periodLabel: context.isCompetenceScope
      ? `${context.currentMonthBounds.startDate.slice(8, 10)}/${context.currentMonthBounds.startDate.slice(5, 7)} a ${context.currentMonthBounds.endDate.slice(8, 10)}/${context.currentMonthBounds.endDate.slice(5, 7)}`
      : "Desde o início dos registros",
    options,
    permissions,
    summary: {
      activeEmployees: activeAtEnd,
      averageHeadcount: currentTurnover.averageHeadcount,
      admissions: currentTurnover.admissions,
      terminations: currentTurnover.terminations,
      turnoverRate: currentTurnover.turnoverRate,
      terminationTurnoverRate: currentTurnover.terminationTurnoverRate,
      turnoverStatus: currentTurnover.status,
      turnoverVariationPp,
    },
    turnover: {
      current: currentTurnover,
      previous: previousTurnover,
      evolution: turnoverEvolution.map((item) => ({
        label: item.label,
        value: item.turnoverRate,
        detail: `${item.admissions} adm. / ${item.terminations} desl.`,
      })),
      admissionsVsTerminations: turnoverEvolution.map((item) => ({
        label: item.label,
        admissoes: item.admissions,
        desligamentos: item.terminations,
      })),
      byDepartment: turnoverByDepartment(employees, context.referenceMonth),
    },
    employeesByDepartment: groupByDepartment(employees, context.referenceMonth).slice(0, 8),
  };
}

export async function getHrDashboardCore(filters: HrDashboardFilters = {}): Promise<HrDashboardCoreData> {
  const context = buildDashboardContext(filters);
  const [options, employees, permissions] = await Promise.all([
    loadOptions(),
    loadEmployees(filters),
    loadDashboardPermissions(),
  ]);

  return buildDashboardCorePayload(employees, options, permissions, context);
}

export async function getHrDashboardCosts(filters: HrDashboardFilters = {}): Promise<HrDashboardCosts | null> {
  const context = buildDashboardContext(filters);
  const permissions = await loadDashboardPermissions();

  if (!permissions.canViewCosts) {
    return null;
  }

  const laborDashboard = await getLaborCostDashboard(context.referenceMonth, {
    departmentId: filters.departmentId,
    departmentIds: filters.departmentIds,
    employmentTypeId: filters.employmentTypeId,
    employmentTypeIds: filters.employmentTypeIds,
    statusId: filters.statusId,
    statusIds: filters.statusIds,
  });

  return buildCostPayload(laborDashboard);
}

export async function getHrDashboardOccurrences(
  filters: HrDashboardFilters = {},
): Promise<HrDashboardOccurrencesData> {
  const context = buildDashboardContext(filters);
  const [employees, occurrences, permissions] = await Promise.all([
    loadEmployees(filters),
    loadOccurrences(
      context.isCompetenceScope ? context.firstMonthBounds.startDate : null,
      context.isCompetenceScope ? context.currentMonthBounds.endDate : null,
      filters,
    ),
    loadDashboardPermissions(),
  ]);
  const scopedOccurrences = context.isCompetenceScope
    ? occurrences.filter((occurrence) =>
        isDateInRange(occurrence.occurred_at, context.currentMonthBounds.startDate, context.currentMonthBounds.endDate),
      )
    : occurrences;
  const analytics = buildOccurrenceAnalytics(scopedOccurrences, employees, {
    includeEmployeeDetails: permissions.canViewOccurrenceSensitive,
    includeRankings: permissions.canViewOccurrenceRankings,
  });

  return {
    summary: {
      occurrencesTotal: analytics.total,
      occurrenceImpactedDays: analytics.impactedDays,
      punishmentOccurrences: analytics.punishmentCount,
      averageOccurrencesPerEmployee: analytics.averagePerEmployee,
      averageOccurrencesPerDepartment: analytics.averagePerDepartment,
    },
    evolution: buildOccurrenceEvolution(occurrences, context.monthSequence),
    byType: buildOccurrencesByType(scopedOccurrences),
    topDepartments: buildOccurrenceDepartments(scopedOccurrences),
    analytics,
  };
}

export async function getHrDashboardAlerts(filters: HrDashboardFilters = {}): Promise<HrDashboardAlertsData> {
  const context = buildDashboardContext(filters);
  const [employees, alerts] = await Promise.all([
    loadEmployees(filters),
    loadAlerts(
      filters,
      context.today,
      context.soon,
      context.currentMonthBounds.startDate,
      context.currentMonthBounds.endDate,
    ),
  ]);

  return {
    summary: {
      expiredDocuments: alerts.expiredDocumentsCount,
      expiringDocuments: alerts.expiringDocumentsCount,
      expiredTrainings: alerts.expiredTrainingsCount,
      expiringTrainings: alerts.expiringTrainingsCount,
      periodVacations: alerts.periodVacationsCount,
      activeLeaves: alerts.activeLeavesCount,
    },
    alerts: {
      expiredDocuments: alerts.expiredDocuments,
      expiringDocuments: alerts.expiringDocuments,
      upcomingBirthdays: buildUpcomingBirthdays(employees, context.referenceMonth),
      periodVacations: alerts.periodVacations,
      activeLeaves: alerts.activeLeaves,
      expiringTrainings: alerts.expiringTrainings,
    },
  };
}

export async function calculateTurnover(referenceMonth = getDefaultReferenceMonth(), filters: HrDashboardFilters = {}) {
  const employees = await loadEmployees(filters);
  const { endDate } = getMonthBounds(referenceMonth);
  const activeAtEnd = employees.filter((employee) => isActiveOnDate(employee, endDate)).length;
  return turnoverForMonth(employees, referenceMonth, activeAtEnd);
}

export async function getTurnoverEvolution(months = 6, filters: HrDashboardFilters = {}) {
  const referenceMonth = normalizeReferenceMonth(filters.referenceMonth ?? getDefaultReferenceMonth());
  const employees = await loadEmployees(filters);
  const { endDate } = getMonthBounds(referenceMonth);
  const activeAtEnd = employees.filter((employee) => isActiveOnDate(employee, endDate)).length;

  return getMonthSequence(referenceMonth, months).map((month) => turnoverForMonth(employees, month, activeAtEnd));
}

export async function getAdmissionsVsTerminations(months = 6, filters: HrDashboardFilters = {}) {
  const evolution = await getTurnoverEvolution(months, filters);

  return evolution.map((item) => ({
    label: item.label,
    admissoes: item.admissions,
    desligamentos: item.terminations,
  }));
}

export async function getLaborCostByDepartment(referenceMonth = getDefaultReferenceMonth(), filters: HrDashboardFilters = {}) {
  const dashboard = await getLaborCostDashboard(referenceMonth, {
    departmentId: filters.departmentId,
    departmentIds: filters.departmentIds,
    employmentTypeId: filters.employmentTypeId,
    employmentTypeIds: filters.employmentTypeIds,
    statusId: filters.statusId,
    statusIds: filters.statusIds,
  });

  return dashboard.departmentCosts;
}

export async function getPayrollCostComposition(referenceMonth = getDefaultReferenceMonth(), filters: HrDashboardFilters = {}) {
  const dashboard = await getLaborCostDashboard(referenceMonth, {
    departmentId: filters.departmentId,
    departmentIds: filters.departmentIds,
    employmentTypeId: filters.employmentTypeId,
    employmentTypeIds: filters.employmentTypeIds,
    statusId: filters.statusId,
    statusIds: filters.statusIds,
  });

  return buildCostComposition(dashboard);
}

export async function getOccurrencesEvolution(months = 6, filters: HrDashboardFilters = {}) {
  const referenceMonth = normalizeReferenceMonth(filters.referenceMonth ?? getDefaultReferenceMonth());
  const monthSequence = getMonthSequence(referenceMonth, months);
  const firstMonthBounds = getMonthBounds(monthSequence[0] ?? referenceMonth);
  const currentMonthBounds = getMonthBounds(referenceMonth);
  const occurrences = await loadOccurrences(firstMonthBounds.startDate, currentMonthBounds.endDate, filters);

  return buildOccurrenceEvolution(occurrences, monthSequence);
}

export async function getOccurrencesByType(referenceMonth = getDefaultReferenceMonth(), filters: HrDashboardFilters = {}) {
  const bounds = getMonthBounds(referenceMonth);
  const occurrences = await loadOccurrences(bounds.startDate, bounds.endDate, filters);
  return buildOccurrencesByType(occurrences, referenceMonth);
}

export async function getEmployeesByDepartment(filters: HrDashboardFilters = {}) {
  const referenceMonth = normalizeReferenceMonth(filters.referenceMonth ?? getDefaultReferenceMonth());
  const employees = await loadEmployees(filters);
  return groupByDepartment(employees, referenceMonth);
}

export async function getHrDashboardSummary(filters: HrDashboardFilters = {}): Promise<HrDashboardData> {
  const scope: DashboardScope = filters.scope ?? (filters.referenceMonth ? "competence" : "general");
  const isCompetenceScope = scope === "competence";
  const referenceMonth = normalizeReferenceMonth(filters.referenceMonth ?? getDefaultReferenceMonth());
  const referenceMonthInput = referenceMonth.slice(0, 7);
  const monthCount = filters.evolutionMonths ?? (isCompetenceScope ? 6 : 12);
  const monthSequence = getMonthSequence(referenceMonth, monthCount);
  const firstMonthBounds = getMonthBounds(monthSequence[0] ?? referenceMonth);
  const currentMonthBounds = getMonthBounds(referenceMonth);
  const previousMonth = shiftMonth(referenceMonth, -1);
  const today = new Date().toISOString().slice(0, 10);
  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 30);
  const soon = soonDate.toISOString().slice(0, 10);

  const [
    options,
    employees,
    alerts,
    occurrences,
    currentAccess,
    canViewDashboardCosts,
    canViewSensitiveCosts,
    canViewLaborDashboard,
    canViewOccurrenceRankingsPermission,
    canViewOccurrenceSensitivePermission,
  ] =
    await Promise.all([
      loadOptions(),
      loadEmployees(filters),
      loadAlerts(filters, today, soon, currentMonthBounds.startDate, currentMonthBounds.endDate),
      loadOccurrences(isCompetenceScope ? firstMonthBounds.startDate : null, isCompetenceScope ? currentMonthBounds.endDate : null, filters),
      getCurrentUserAccess(),
      checkPermission("hr.dashboard.costs.view"),
      checkPermission("hr.labor_costs.view_sensitive_values"),
      checkPermission("hr.labor_costs.dashboard"),
      checkPermission("hr.dashboard.occurrences.rankings"),
      checkPermission("hr.dashboard.occurrences.sensitive"),
    ]);

  const activeReferenceDate = isCompetenceScope ? currentMonthBounds.endDate : today;
  const activeAtEnd = employees.filter((employee) => isActiveOnDate(employee, activeReferenceDate)).length;
  const historicalMonthSequence = getMonthSequenceBetween(
    getFirstHistoricalMonth(employees, referenceMonth),
    referenceMonth,
  );
  const historicalTurnover = historicalMonthSequence.map((month) => turnoverForMonth(employees, month, activeAtEnd));
  const totalAdmissions = employees.filter((employee) => employee.hire_date).length;
  const totalTerminations = employees.filter((employee) => employee.termination_date).length;
  const averageHistoricalHeadcount = Math.round(average(historicalTurnover.map((item) => item.averageHeadcount)));
  const averageHistoricalTurnover = average(historicalTurnover.map((item) => item.turnoverRate));
  const averageHistoricalTerminationTurnover = average(historicalTurnover.map((item) => item.terminationTurnoverRate));
  const currentTurnover = isCompetenceScope
    ? turnoverForMonth(employees, referenceMonth, activeAtEnd)
    : {
        referenceMonth,
        label: "Historico",
        admissions: totalAdmissions,
        terminations: totalTerminations,
        activeAtStart: historicalTurnover[0]?.activeAtStart ?? activeAtEnd,
        activeAtEnd,
        averageHeadcount: averageHistoricalHeadcount,
        turnoverRate: averageHistoricalTurnover,
        terminationTurnoverRate: averageHistoricalTerminationTurnover,
        status: getTurnoverStatus(averageHistoricalTurnover),
      };
  const previousTurnover = turnoverForMonth(employees, previousMonth, activeAtEnd);
  const turnoverVariationPp = isCompetenceScope
    ? roundMoney(currentTurnover.turnoverRate - previousTurnover.turnoverRate)
    : null;
  const isMaster = currentAccess?.roles.some((role) => role.key === "master") ?? false;
  const canViewCosts = isMaster || (canViewSensitiveCosts && (canViewDashboardCosts || canViewLaborDashboard));
  const canViewOccurrenceRankings = isMaster || canViewOccurrenceRankingsPermission;
  const canViewOccurrenceSensitive = isMaster || canViewOccurrenceSensitivePermission;
  let costs: HrDashboardCosts | null = null;

  if (canViewCosts) {
    const laborDashboard = await getLaborCostDashboard(referenceMonth, {
      departmentId: filters.departmentId,
      departmentIds: filters.departmentIds,
      employmentTypeId: filters.employmentTypeId,
      employmentTypeIds: filters.employmentTypeIds,
      statusId: filters.statusId,
      statusIds: filters.statusIds,
    });
    costs = buildCostPayload(laborDashboard);
  }

  const turnoverEvolution = monthSequence.map((month) => turnoverForMonth(employees, month, activeAtEnd));
  const scopedOccurrences = isCompetenceScope
    ? occurrences.filter((occurrence) =>
        isDateInRange(occurrence.occurred_at, currentMonthBounds.startDate, currentMonthBounds.endDate),
      )
    : occurrences;
  const occurrenceAnalytics = buildOccurrenceAnalytics(scopedOccurrences, employees, {
    includeEmployeeDetails: canViewOccurrenceSensitive,
    includeRankings: canViewOccurrenceRankings,
  });
  const upcomingBirthdays = employees
    .filter((employee) => {
      if (!employee.birth_date) {
        return false;
      }

      return Number(employee.birth_date.slice(5, 7)) === Number(referenceMonth.slice(5, 7));
    })
    .map((employee) => ({
      id: employee.id,
      name: employee.full_name,
      birthDate: employee.birth_date ?? "",
    }))
    .slice(0, 8);

  return {
    scope,
    scopeLabel: isCompetenceScope ? `Competência: ${formatMonthLabel(referenceMonth)}/${referenceMonth.slice(0, 4)}` : "Visão geral",
    scopeDescription: isCompetenceScope
      ? `Dados da competência ${currentMonthBounds.startDate.slice(8, 10)}/${currentMonthBounds.startDate.slice(5, 7)} a ${currentMonthBounds.endDate.slice(8, 10)}/${currentMonthBounds.endDate.slice(5, 7)}.`
      : "Dados históricos consolidados desde o início dos registros.",
    referenceMonth,
    referenceMonthInput,
    periodLabel: isCompetenceScope
      ? `${currentMonthBounds.startDate.slice(8, 10)}/${currentMonthBounds.startDate.slice(5, 7)} a ${currentMonthBounds.endDate.slice(8, 10)}/${currentMonthBounds.endDate.slice(5, 7)}`
      : "Desde o início dos registros",
    options,
    permissions: {
      canViewCosts,
      canViewOccurrenceRankings,
      canViewOccurrenceSensitive,
      costsHiddenReason: canViewCosts
        ? undefined
        : "Custos de folha ocultos pelas permissões sensíveis de custos de mão de obra.",
      occurrenceRankingsHiddenReason: canViewOccurrenceRankings
        ? undefined
        : "Rankings de ocorrências ocultos pelas permissões do dashboard.",
      occurrenceSensitiveHiddenReason: canViewOccurrenceSensitive
        ? undefined
        : "Dados nominais de colaboradores ocultos pela permissão sensível de ocorrências.",
    },
    summary: {
      activeEmployees: activeAtEnd,
      averageHeadcount: currentTurnover.averageHeadcount,
      admissions: currentTurnover.admissions,
      terminations: currentTurnover.terminations,
      turnoverRate: currentTurnover.turnoverRate,
      terminationTurnoverRate: currentTurnover.terminationTurnoverRate,
      turnoverStatus: currentTurnover.status,
      turnoverVariationPp,
      payrollTotal: costs?.dashboard.totalEstimatedCost ?? null,
      averageCostPerEmployee: costs?.dashboard.averageCostPerEmployee ?? null,
      expiredDocuments: alerts.expiredDocumentsCount,
      expiringDocuments: alerts.expiringDocumentsCount,
      expiredTrainings: alerts.expiredTrainingsCount,
      expiringTrainings: alerts.expiringTrainingsCount,
      periodVacations: alerts.periodVacationsCount,
      activeLeaves: alerts.activeLeavesCount,
      occurrencesTotal: occurrenceAnalytics.total,
      occurrenceImpactedDays: occurrenceAnalytics.impactedDays,
      punishmentOccurrences: occurrenceAnalytics.punishmentCount,
      averageOccurrencesPerEmployee: occurrenceAnalytics.averagePerEmployee,
      averageOccurrencesPerDepartment: occurrenceAnalytics.averagePerDepartment,
    },
    turnover: {
      current: currentTurnover,
      previous: previousTurnover,
      evolution: turnoverEvolution.map((item) => ({
        label: item.label,
        value: item.turnoverRate,
        detail: `${item.admissions} adm. / ${item.terminations} desl.`,
      })),
      admissionsVsTerminations: turnoverEvolution.map((item) => ({
        label: item.label,
        admissoes: item.admissions,
        desligamentos: item.terminations,
      })),
      byDepartment: turnoverByDepartment(employees, referenceMonth),
    },
    costs,
    employeesByDepartment: groupByDepartment(employees, referenceMonth).slice(0, 8),
    occurrences: {
      evolution: buildOccurrenceEvolution(occurrences, monthSequence),
      byType: buildOccurrencesByType(scopedOccurrences),
      topDepartments: buildOccurrenceDepartments(scopedOccurrences),
      analytics: occurrenceAnalytics,
    },
    alerts: {
      expiredDocuments: alerts.expiredDocuments,
      expiringDocuments: alerts.expiringDocuments,
      upcomingBirthdays,
      periodVacations: alerts.periodVacations,
      activeLeaves: alerts.activeLeaves,
      expiringTrainings: alerts.expiringTrainings,
    },
  };
}

export function formatDashboardCurrency(value: number | null) {
  return value === null ? "Restrito" : formatCurrencyBRL(value);
}
