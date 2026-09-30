import { createAuditLog, createEmployeeHistoryEvent } from "@/modules/hr/services/audit.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import { createEmployeeAdmissionMovementSeed } from "@/modules/hr/services/movements.service";
import type { Employee, EmployeeAddress, EmployeeUpsertInput, ID } from "@/modules/hr/types";
import { validateRequiredEmployeeFields } from "@/modules/hr/utils/validation";

export interface EmployeeFilters {
  search?: string;
  cpf?: string;
  email?: string;
  employeeNumber?: string;
  departmentId?: ID;
  departmentIds?: ID[];
  positionId?: ID;
  positionIds?: ID[];
  statusId?: ID;
  statusIds?: ID[];
  employmentTypeId?: ID;
  employmentTypeIds?: ID[];
  managerEmployeeId?: ID;
  managerEmployeeIds?: ID[];
}

export const EMPLOYEE_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_EMPLOYEE_PAGE_SIZE = 25;
export const DEFAULT_EMPLOYEE_SORT = "name";
export const DEFAULT_EMPLOYEE_SORT_ORDER = "asc";

export type EmployeePageSize = (typeof EMPLOYEE_PAGE_SIZE_OPTIONS)[number];
export type EmployeeSortKey = "name" | "department" | "position" | "status" | "hireDate";
export type EmployeeSortOrder = "asc" | "desc";

export interface EmployeeListQueryOptions {
  page?: number;
  pageSize?: number;
  sortBy?: EmployeeSortKey;
  sortOrder?: EmployeeSortOrder;
}

export interface PaginatedEmployeesResult {
  employees: Employee[];
  totalCount: number;
  page: number;
  pageSize: EmployeePageSize;
  sortBy: EmployeeSortKey;
  sortOrder: EmployeeSortOrder;
}

const employeeSelect = `
  *,
  address:employee_addresses(*),
  department:departments(*),
  position:positions(*),
  employment_type:employment_types(*),
  marital_status_record:marital_statuses(*),
  status:employee_statuses(*),
  company_unit:company_units(*),
  cost_center:cost_centers(*)
`;

const employeeSortColumns: Record<EmployeeSortKey, string> = {
  name: "full_name",
  department: "department(name)",
  position: "position(name)",
  status: "status(name)",
  hireDate: "hire_date",
};

function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

function validateEmployeeInput(input: EmployeeUpsertInput) {
  const validation = validateRequiredEmployeeFields(input.employee);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }
}

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeEmployeePayload(employee: EmployeeUpsertInput["employee"]) {
  return {
    ...employee,
    profile_id: cleanString(employee.profile_id),
    full_name: employee.full_name.trim(),
    cpf: normalizeCpf(employee.cpf),
    rg: cleanString(employee.rg),
    birth_date: cleanString(employee.birth_date),
    nationality: cleanString(employee.nationality),
    marital_status: cleanString(employee.marital_status),
    marital_status_id: cleanString(employee.marital_status_id),
    phone: cleanString(employee.phone),
    email: cleanString(employee.email),
    emergency_contact_name: cleanString(employee.emergency_contact_name),
    emergency_contact_phone: cleanString(employee.emergency_contact_phone),
    employee_number: employee.employee_number.trim(),
    hire_date: employee.hire_date,
    termination_date: cleanString(employee.termination_date),
    termination_reason_id: cleanString(employee.termination_reason_id),
    employment_type_id: cleanString(employee.employment_type_id),
    department_id: cleanString(employee.department_id),
    position_id: cleanString(employee.position_id),
    manager_employee_id: cleanString(employee.manager_employee_id),
    status_id: cleanString(employee.status_id),
    company_unit_id: cleanString(employee.company_unit_id),
    cost_center_id: cleanString(employee.cost_center_id),
    work_schedule: cleanString(employee.work_schedule),
    internal_notes: cleanString(employee.internal_notes),
  };
}

function normalizeEmployeeListOptions(options: EmployeeListQueryOptions = {}) {
  const page = Number.isInteger(options.page) && Number(options.page) > 0 ? Number(options.page) : 1;
  const pageSize = EMPLOYEE_PAGE_SIZE_OPTIONS.includes(options.pageSize as EmployeePageSize)
    ? (options.pageSize as EmployeePageSize)
    : DEFAULT_EMPLOYEE_PAGE_SIZE;
  const sortBy = options.sortBy && options.sortBy in employeeSortColumns ? options.sortBy : DEFAULT_EMPLOYEE_SORT;
  const sortOrder: EmployeeSortOrder = options.sortOrder === "desc" ? "desc" : DEFAULT_EMPLOYEE_SORT_ORDER;

  return {
    page,
    pageSize,
    sortBy,
    sortOrder,
  };
}

function normalizeAddressPayload(address?: Partial<EmployeeAddress>) {
  if (!address) {
    return null;
  }

  const normalized = {
    postal_code: cleanString(address.postal_code),
    street: cleanString(address.street),
    number: cleanString(address.number),
    complement: cleanString(address.complement),
    district: cleanString(address.district),
    city: cleanString(address.city),
    state: cleanString(address.state),
  };

  const hasAnyValue = Object.values(normalized).some((value) => value !== null && value !== undefined);

  return hasAnyValue ? normalized : null;
}

async function hydrateEmployeeManagers(employees: Employee[]) {
  const managerIds = Array.from(
    new Set(employees.map((employee) => employee.manager_employee_id).filter(Boolean)),
  ) as ID[];

  if (managerIds.length === 0) {
    return employees.map((employee) => ({ ...employee, manager: null }));
  }

  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_number")
    .in("id", managerIds);

  if (error) {
    throw new Error(error.message);
  }

  const managerById = new Map((data ?? []).map((manager) => [manager.id, manager]));

  return employees.map((employee) => ({
    ...employee,
    manager: employee.manager_employee_id
      ? (managerById.get(employee.manager_employee_id) ?? null)
      : null,
  }));
}

export async function listEmployees(filters: EmployeeFilters = {}) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employees")
    .select(employeeSelect)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (filters.search?.trim()) {
    const search = filters.search.trim().replace(/[%(),]/g, "");
    query = query.or(
      `full_name.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%,employee_number.ilike.%${search}%`,
    );
  }

  if (filters.cpf?.trim()) {
    query = query.ilike("cpf", `%${normalizeCpf(filters.cpf)}%`);
  }

  if (filters.email?.trim()) {
    query = query.ilike("email", `%${filters.email.trim()}%`);
  }

  if (filters.employeeNumber?.trim()) {
    query = query.ilike("employee_number", `%${filters.employeeNumber.trim()}%`);
  }

  if (filters.departmentIds && filters.departmentIds.length > 0) {
    query = query.in("department_id", Array.from(new Set(filters.departmentIds)));
  } else if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }

  if (filters.positionIds && filters.positionIds.length > 0) {
    query = query.in("position_id", Array.from(new Set(filters.positionIds)));
  } else if (filters.positionId) {
    query = query.eq("position_id", filters.positionId);
  }

  if (filters.statusIds && filters.statusIds.length > 0) {
    query = query.in("status_id", Array.from(new Set(filters.statusIds)));
  } else if (filters.statusId) {
    query = query.eq("status_id", filters.statusId);
  }

  if (filters.employmentTypeIds && filters.employmentTypeIds.length > 0) {
    query = query.in("employment_type_id", Array.from(new Set(filters.employmentTypeIds)));
  } else if (filters.employmentTypeId) {
    query = query.eq("employment_type_id", filters.employmentTypeId);
  }

  if (filters.managerEmployeeIds && filters.managerEmployeeIds.length > 0) {
    query = query.in("manager_employee_id", Array.from(new Set(filters.managerEmployeeIds)));
  } else if (filters.managerEmployeeId) {
    query = query.eq("manager_employee_id", filters.managerEmployeeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return hydrateEmployeeManagers((data ?? []) as unknown as Employee[]);
}

export async function listEmployeesPaginated(
  filters: EmployeeFilters = {},
  options: EmployeeListQueryOptions = {},
): Promise<PaginatedEmployeesResult> {
  const supabase = getHrSupabaseClient();
  const { page, pageSize, sortBy, sortOrder } = normalizeEmployeeListOptions(options);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const ascending = sortOrder === "asc";
  let query = supabase
    .from("employees")
    .select(employeeSelect, { count: "exact" })
    .is("deleted_at", null);

  if (filters.search?.trim()) {
    const search = filters.search.trim().replace(/[%(),]/g, "");
    query = query.or(
      `full_name.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%,employee_number.ilike.%${search}%`,
    );
  }

  if (filters.cpf?.trim()) {
    query = query.ilike("cpf", `%${normalizeCpf(filters.cpf)}%`);
  }

  if (filters.email?.trim()) {
    query = query.ilike("email", `%${filters.email.trim()}%`);
  }

  if (filters.employeeNumber?.trim()) {
    query = query.ilike("employee_number", `%${filters.employeeNumber.trim()}%`);
  }

  if (filters.departmentIds && filters.departmentIds.length > 0) {
    query = query.in("department_id", Array.from(new Set(filters.departmentIds)));
  } else if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }

  if (filters.positionIds && filters.positionIds.length > 0) {
    query = query.in("position_id", Array.from(new Set(filters.positionIds)));
  } else if (filters.positionId) {
    query = query.eq("position_id", filters.positionId);
  }

  if (filters.statusIds && filters.statusIds.length > 0) {
    query = query.in("status_id", Array.from(new Set(filters.statusIds)));
  } else if (filters.statusId) {
    query = query.eq("status_id", filters.statusId);
  }

  if (filters.employmentTypeIds && filters.employmentTypeIds.length > 0) {
    query = query.in("employment_type_id", Array.from(new Set(filters.employmentTypeIds)));
  } else if (filters.employmentTypeId) {
    query = query.eq("employment_type_id", filters.employmentTypeId);
  }

  if (filters.managerEmployeeIds && filters.managerEmployeeIds.length > 0) {
    query = query.in("manager_employee_id", Array.from(new Set(filters.managerEmployeeIds)));
  } else if (filters.managerEmployeeId) {
    query = query.eq("manager_employee_id", filters.managerEmployeeId);
  }

  query = query.order(employeeSortColumns[sortBy], { ascending, nullsFirst: false });

  if (sortBy !== "name") {
    query = query.order("full_name", { ascending: true });
  }

  query = query.order("id", { ascending: true }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    employees: await hydrateEmployeeManagers((data ?? []) as unknown as Employee[]),
    totalCount: count ?? 0,
    page,
    pageSize,
    sortBy,
    sortOrder,
  };
}

export async function listEmployeeManagerOptions() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_number")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<Pick<Employee, "id" | "full_name" | "employee_number">>;
}

export async function getEmployeeById(employeeId: ID) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employees")
    .select(employeeSelect)
    .eq("id", employeeId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const [employee] = await hydrateEmployeeManagers([data as unknown as Employee]);

  return employee;
}

export async function createEmployee(input: EmployeeUpsertInput) {
  validateEmployeeInput(input);

  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const { address, employee } = input;
  const employeePayload = normalizeEmployeePayload(employee);
  const addressPayload = normalizeAddressPayload(address);

  const { data, error } = await supabase
    .from("employees")
    .insert({
      ...employeePayload,
      created_by: user.data.user?.id,
      updated_by: user.data.user?.id,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const created = data as Employee;

  if (addressPayload) {
    const { error: addressError } = await supabase.from("employee_addresses").insert({
      ...addressPayload,
      employee_id: created.id,
      created_by: user.data.user?.id,
      updated_by: user.data.user?.id,
    });

    if (addressError) {
      throw new Error(addressError.message);
    }
  }

  await createAuditLog({
    action: "employee.created",
    entity: "employees",
    entity_id: created.id,
    new_value: created,
  });

  await createEmployeeHistoryEvent({
    employee_id: created.id,
    event_type: "admission",
    title: "Admissão registrada",
    description: `Colaborador ${created.full_name} cadastrado no RH.`,
    source_entity: "employees",
    source_entity_id: created.id,
  });

  await createEmployeeAdmissionMovementSeed(created);

  return created;
}

export async function updateEmployee(employeeId: ID, input: EmployeeUpsertInput) {
  validateEmployeeInput(input);

  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const before = await getEmployeeById(employeeId);
  const { address, employee } = input;
  const employeePayload = normalizeEmployeePayload(employee);
  const addressPayload = normalizeAddressPayload(address);

  const { data, error } = await supabase
    .from("employees")
    .update({
      ...employeePayload,
      updated_by: user.data.user?.id,
    })
    .eq("id", employeeId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (addressPayload) {
    const { error: addressError } = await supabase.from("employee_addresses").upsert(
      {
        ...addressPayload,
        employee_id: employeeId,
        updated_by: user.data.user?.id,
      },
      { onConflict: "employee_id" },
    );

    if (addressError) {
      throw new Error(addressError.message);
    }
  }

  const updated = data as Employee;

  await createAuditLog({
    action: "employee.updated",
    entity: "employees",
    entity_id: employeeId,
    old_value: before,
    new_value: updated,
  });

  await createEmployeeHistoryEvent({
    employee_id: employeeId,
    event_type: "profile_updated",
    title: "Cadastro atualizado",
    description: "Dados cadastrais do colaborador foram atualizados.",
    source_entity: "employees",
    source_entity_id: employeeId,
  });

  return updated;
}

export async function inactivateEmployee(employeeId: ID, terminationDate?: string) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const before = await getEmployeeById(employeeId);
  const inactiveStatus = await supabase
    .from("employee_statuses")
    .select("id")
    .eq("key", "inativo")
    .maybeSingle();

  const { data, error } = await supabase
    .from("employees")
    .update({
      is_active: false,
      status_id: inactiveStatus.data?.id ?? before.status_id,
      termination_date: terminationDate ?? new Date().toISOString().slice(0, 10),
      updated_by: user.data.user?.id,
    })
    .eq("id", employeeId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "employee.inactivated",
    entity: "employees",
    entity_id: employeeId,
    old_value: before,
    new_value: data,
  });

  await createEmployeeHistoryEvent({
    employee_id: employeeId,
    event_type: "termination",
    title: "Colaborador inativado",
    description: "Colaborador marcado como inativo/desligado.",
    source_entity: "employees",
    source_entity_id: employeeId,
  });

  return data as Employee;
}
