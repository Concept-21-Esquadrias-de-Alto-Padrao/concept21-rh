"use client";

import { Eye, Pencil, Plus, UserMinus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActiveFilters,
  FilterBar,
  MultiSelectFilter,
  SearchFilter,
  type ActiveFilterChip,
} from "@/components/filters";
import {
  DataTablePageSize,
  DataTablePagination,
  SortableTableHeader,
} from "@/components/data-table";
import { useFilterSearchParams } from "@/hooks/useFilterSearchParams";
import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmployeeForm } from "@/modules/hr/components/EmployeeForm";
import { EmployeeMovementForm } from "@/modules/hr/components/EmployeeMovementForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import {
  DEFAULT_EMPLOYEE_PAGE_SIZE,
  DEFAULT_EMPLOYEE_SORT,
  DEFAULT_EMPLOYEE_SORT_ORDER,
  EMPLOYEE_PAGE_SIZE_OPTIONS,
  createEmployee,
  listEmployeeManagerOptions,
  listEmployeesPaginated,
  updateEmployee,
  type EmployeeFilters,
  type EmployeeListQueryOptions,
  type EmployeePageSize,
  type EmployeeSortKey,
  type EmployeeSortOrder,
} from "@/modules/hr/services/employees.service";
import {
  createEmployeeMovement,
  listEmployeeMovementCostCategories,
} from "@/modules/hr/services/movements.service";
import { checkUserPermission } from "@/modules/hr/services/permissions.service";
import { listSettingItems } from "@/modules/hr/services/settings.service";
import type {
  CompanyUnit,
  CostCenter,
  Department,
  Employee,
  EmployeeMovementCostCategory,
  EmployeeStatus,
  EmploymentType,
  MaritalStatus,
  Position,
  TerminationReason,
} from "@/modules/hr/types";
import { formatCpf, formatDate } from "@/modules/hr/utils/format";

interface EmployeesPageData {
  employees: Employee[];
  totalCount: number;
  departments: Department[];
  positions: Position[];
  employmentTypes: EmploymentType[];
  maritalStatuses: MaritalStatus[];
  statuses: EmployeeStatus[];
  companyUnits: CompanyUnit[];
  costCenters: CostCenter[];
  terminationReasons: TerminationReason[];
  movementCostCategories: EmployeeMovementCostCategory[];
  canManageMovements: boolean;
}

async function loadEmployeesPageData(
  filters: EmployeeFilters,
  listOptions: EmployeeListQueryOptions,
): Promise<EmployeesPageData> {
  const [
    employeeResult,
    departments,
    positions,
    employmentTypes,
    maritalStatuses,
    statuses,
    companyUnits,
    costCenters,
    terminationReasons,
    movementCostCategories,
    canManageMovements,
  ] = await Promise.all([
    listEmployeesPaginated(filters, listOptions),
    listSettingItems("departments"),
    listSettingItems("positions"),
    listSettingItems("employment_types"),
    listSettingItems("marital_statuses"),
    listSettingItems("employee_statuses"),
    listSettingItems("company_units"),
    listSettingItems("cost_centers"),
    listSettingItems("termination_reasons"),
    listEmployeeMovementCostCategories({ includeInactive: true }),
    checkUserPermission("hr.movements.manage"),
  ]);

  return {
    employees: employeeResult.employees,
    totalCount: employeeResult.totalCount,
    departments: departments as Department[],
    positions: positions as Position[],
    employmentTypes: employmentTypes as EmploymentType[],
    maritalStatuses: maritalStatuses as MaritalStatus[],
    statuses: statuses as EmployeeStatus[],
    companyUnits: companyUnits as CompanyUnit[],
    costCenters: costCenters as CostCenter[],
    terminationReasons: terminationReasons as TerminationReason[],
    movementCostCategories,
    canManageMovements,
  };
}

const employeeSortKeys = ["name", "department", "position", "status", "hireDate"] as const;
const employeeSortOrders = ["asc", "desc"] as const;
const employeeFilterParamKeys = [
  "q",
  "departments",
  "positions",
  "statuses",
  "employmentTypes",
  "page",
  "sort",
  "order",
];

export function EmployeesPage() {
  const filterParams = useFilterSearchParams();
  const search = filterParams.getString("q");
  const departmentIds = filterParams.getArray("departments");
  const positionIds = filterParams.getArray("positions");
  const statusIds = filterParams.getArray("statuses");
  const employmentTypeIds = filterParams.getArray("employmentTypes");
  const page = filterParams.getNumber("page", 1, { min: 1 });
  const pageSizeParam = filterParams.getNumber("pageSize", DEFAULT_EMPLOYEE_PAGE_SIZE);
  const pageSize = EMPLOYEE_PAGE_SIZE_OPTIONS.includes(pageSizeParam as EmployeePageSize)
    ? (pageSizeParam as EmployeePageSize)
    : DEFAULT_EMPLOYEE_PAGE_SIZE;
  const sortBy = filterParams.getEnum<EmployeeSortKey>("sort", employeeSortKeys, DEFAULT_EMPLOYEE_SORT);
  const sortOrder = filterParams.getEnum<EmployeeSortOrder>(
    "order",
    employeeSortOrders,
    DEFAULT_EMPLOYEE_SORT_ORDER,
  );
  const filters: EmployeeFilters = {
    search: search || undefined,
    departmentIds: departmentIds.length > 0 ? departmentIds : undefined,
    positionIds: positionIds.length > 0 ? positionIds : undefined,
    statusIds: statusIds.length > 0 ? statusIds : undefined,
    employmentTypeIds: employmentTypeIds.length > 0 ? employmentTypeIds : undefined,
  };
  const listOptions: EmployeeListQueryOptions = {
    page,
    pageSize,
    sortBy,
    sortOrder,
  };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [terminatingEmployee, setTerminatingEmployee] = useState<Employee | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const filterKey = JSON.stringify({ filters, listOptions });
  const { data, loading, error, reload } = useAsyncResource(
    () => loadEmployeesPageData(filters, listOptions),
    filterKey,
  );
  const {
    data: managerOptionsData,
    loading: managerOptionsLoading,
    error: managerOptionsError,
    reload: reloadManagerOptions,
  } = useAsyncResource(
    () => (drawerOpen ? listEmployeeManagerOptions() : Promise.resolve([])),
    drawerOpen ? "employee-manager-options" : "employee-manager-options-closed",
  );
  const pageData = data;
  const managerOptions = managerOptionsData ?? [];
  const totalCount = pageData?.totalCount ?? 0;
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const firstVisibleRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisibleRecord = Math.min(currentPage * pageSize, totalCount);
  const getAriaSort = useCallback(
    (sortKey: EmployeeSortKey) => {
      if (sortBy !== sortKey) {
        return "none" as const;
      }

      return sortOrder === "asc" ? "ascending" : "descending";
    },
    [sortBy, sortOrder],
  );
  const handleSort = useCallback(
    (nextSort: EmployeeSortKey) => {
      const nextOrder: EmployeeSortOrder =
        sortBy === nextSort && sortOrder === "asc" ? "desc" : "asc";
      const isDefaultSort =
        nextSort === DEFAULT_EMPLOYEE_SORT && nextOrder === DEFAULT_EMPLOYEE_SORT_ORDER;

      filterParams.replaceParams(
        {
          sort: isDefaultSort ? null : nextSort,
          order: isDefaultSort ? null : nextOrder,
        },
        { resetPage: true },
      );
    },
    [filterParams, sortBy, sortOrder],
  );
  const handlePageSizeChange = useCallback(
    (nextPageSize: number) => {
      filterParams.replaceParams(
        {
          pageSize: nextPageSize === DEFAULT_EMPLOYEE_PAGE_SIZE ? null : nextPageSize,
        },
        { resetPage: true },
      );
    },
    [filterParams],
  );
  const handlePageChange = useCallback(
    (nextPage: number) => {
      const nextSafePage = Math.min(Math.max(nextPage, 1), totalPages);

      filterParams.replaceParams({ page: nextSafePage <= 1 ? null : nextSafePage });
    },
    [filterParams, totalPages],
  );

  useEffect(() => {
    if (!pageData) {
      return;
    }

    if (totalCount === 0 && page > 1) {
      filterParams.replaceParams({ page: null });
      return;
    }

    if (page > totalPages) {
      filterParams.replaceParams({ page: totalPages <= 1 ? null : totalPages });
    }
  }, [filterParams, page, pageData, totalCount, totalPages]);
  const departmentOptions = useMemo(
    () =>
      pageData?.departments.map((department) => ({
        value: department.id,
        label: department.name,
      })) ?? [],
    [pageData?.departments],
  );
  const positionOptions = useMemo(
    () =>
      pageData?.positions.map((position) => ({
        value: position.id,
        label: position.name,
      })) ?? [],
    [pageData?.positions],
  );
  const statusOptions = useMemo(
    () =>
      pageData?.statuses.map((status) => ({
        value: status.id,
        label: status.name,
      })) ?? [],
    [pageData?.statuses],
  );
  const employmentTypeOptions = useMemo(
    () =>
      pageData?.employmentTypes.map((type) => ({
        value: type.id,
        label: type.name,
      })) ?? [],
    [pageData?.employmentTypes],
  );
  const activeFilters = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    const pushOptionChips = (
      key: string,
      label: string,
      values: string[],
      options: Array<{ value: string; label: string }>,
    ) => {
      values.forEach((value) => {
        const optionLabel = options.find((option) => option.value === value)?.label ?? value;
        chips.push({
          key: `${key}-${value}`,
          label: `${label}: ${optionLabel}`,
          onRemove: () =>
            filterParams.replaceParams(
              { [key]: values.filter((currentValue) => currentValue !== value) },
              { resetPage: true },
            ),
        });
      });
    };

    if (search) {
      chips.push({
        key: "q",
        label: `Busca: ${search}`,
        onRemove: () => filterParams.replaceParams({ q: null }, { resetPage: true }),
      });
    }

    pushOptionChips("departments", "Departamento", departmentIds, departmentOptions);
    pushOptionChips("positions", "Cargo", positionIds, positionOptions);
    pushOptionChips("statuses", "Status", statusIds, statusOptions);
    pushOptionChips("employmentTypes", "Vínculo", employmentTypeIds, employmentTypeOptions);

    return chips;
  }, [
    departmentIds,
    departmentOptions,
    employmentTypeIds,
    employmentTypeOptions,
    filterParams,
    positionIds,
    positionOptions,
    search,
    statusIds,
    statusOptions,
  ]);

  const columns: Array<DataTableColumn<Employee>> = [
    {
      key: "name",
      header: (
        <SortableTableHeader
          label="Colaborador"
          sortKey="name"
          activeSort={sortBy}
          direction={sortOrder}
          onSort={handleSort}
        />
      ),
      ariaSort: getAriaSort("name"),
      render: (employee) => (
        <div>
          <p className="font-medium text-zinc-950">{employee.full_name}</p>
          <p className="font-mono text-xs text-zinc-500">{employee.employee_number}</p>
        </div>
      ),
    },
    {
      key: "cpf",
      header: "CPF",
      render: (employee) => <span className="font-mono text-xs">{formatCpf(employee.cpf)}</span>,
    },
    {
      key: "department",
      header: (
        <SortableTableHeader
          label="Departamento"
          sortKey="department"
          activeSort={sortBy}
          direction={sortOrder}
          onSort={handleSort}
        />
      ),
      ariaSort: getAriaSort("department"),
      render: (employee) => <span className="text-sm text-zinc-800">{employee.department?.name ?? "-"}</span>,
    },
    {
      key: "position",
      header: (
        <SortableTableHeader
          label="Cargo"
          sortKey="position"
          activeSort={sortBy}
          direction={sortOrder}
          onSort={handleSort}
        />
      ),
      ariaSort: getAriaSort("position"),
      render: (employee) => <span className="text-sm text-zinc-800">{employee.position?.name ?? "-"}</span>,
    },
    {
      key: "employment",
      header: "Vínculo",
      render: (employee) => employee.employment_type?.name ?? "-",
    },
    {
      key: "hire_date",
      header: (
        <SortableTableHeader
          label="Admissão"
          sortKey="hireDate"
          activeSort={sortBy}
          direction={sortOrder}
          onSort={handleSort}
        />
      ),
      ariaSort: getAriaSort("hireDate"),
      render: (employee) => formatDate(employee.hire_date),
    },
    {
      key: "status",
      header: (
        <SortableTableHeader
          label="Status"
          sortKey="status"
          activeSort={sortBy}
          direction={sortOrder}
          onSort={handleSort}
        />
      ),
      ariaSort: getAriaSort("status"),
      render: (employee) => (
        <StatusBadge label={employee.status?.name ?? "-"} status={employee.status?.key} />
      ),
    },
    {
      key: "actions",
      header: "Ações",
      render: (employee) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/rh/colaboradores/${employee.id}`}
            className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-[#f97316] hover:text-[#f97316]"
            title="Visualizar"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditingEmployee(employee);
              setDrawerOpen(true);
            }}
            className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-[#f97316] hover:text-[#f97316]"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {pageData?.canManageMovements ? (
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setTerminatingEmployee(employee);
              }}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-red-200 hover:text-red-600"
              title="Registrar desligamento"
            >
              <UserMinus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Prontuário digital"
        title="Colaboradores"
        description="Cadastro central de colaboradores com filtros, status, vínculos, gestor direto e prontuário por abas."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingEmployee(null);
              setDrawerOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
          >
            <Plus className="h-4 w-4" />
            Novo colaborador
          </button>
        }
      />

      <FilterBar>
        <SearchFilter
          label="Busca geral"
          value={search}
          placeholder="Nome, CPF, e-mail, matrícula"
          debounceMs={400}
          onChange={(nextSearch) => filterParams.replaceParams({ q: nextSearch }, { resetPage: true })}
        />
        <MultiSelectFilter
          label="Departamento"
          ariaLabel="Filtrar colaboradores por departamento"
          options={departmentOptions}
          values={filters.departmentIds ?? []}
          placeholder="Todos"
          selectedLabel={(count) => `${count} departamentos`}
          onChange={(nextDepartmentIds) =>
            filterParams.replaceParams({ departments: nextDepartmentIds }, { resetPage: true })
          }
        />
        <MultiSelectFilter
          label="Cargo"
          ariaLabel="Filtrar colaboradores por cargo"
          options={positionOptions}
          values={filters.positionIds ?? []}
          placeholder="Todos"
          searchable
          selectedLabel={(count) => `${count} cargos`}
          onChange={(nextPositionIds) =>
            filterParams.replaceParams({ positions: nextPositionIds }, { resetPage: true })
          }
        />
        <MultiSelectFilter
          label="Status"
          ariaLabel="Filtrar colaboradores por status"
          options={statusOptions}
          values={filters.statusIds ?? []}
          placeholder="Todos"
          selectedLabel={(count) => `${count} status`}
          onChange={(nextStatusIds) =>
            filterParams.replaceParams({ statuses: nextStatusIds }, { resetPage: true })
          }
        />
        <MultiSelectFilter
          label="Tipo de vínculo"
          ariaLabel="Filtrar colaboradores por tipo de vínculo"
          options={employmentTypeOptions}
          values={filters.employmentTypeIds ?? []}
          placeholder="Todos"
          selectedLabel={(count) => `${count} vínculos`}
          onChange={(nextEmploymentTypeIds) =>
            filterParams.replaceParams({ employmentTypes: nextEmploymentTypeIds }, { resetPage: true })
          }
        />
      </FilterBar>
      <ActiveFilters
        filters={activeFilters}
        onClearAll={() => filterParams.clearParams(employeeFilterParamKeys)}
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {actionError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {pageData ? (
        <SectionCard
          title="Base de colaboradores"
          description={`${pageData.totalCount} registro(s) encontrado(s)`}
        >
          <DataTable
            data={pageData.employees}
            columns={columns}
            getRowKey={(employee) => employee.id}
            emptyState={
              <EmptyState
                title="Nenhum colaborador encontrado"
                description="Cadastre o primeiro colaborador ou ajuste os filtros."
              />
            }
          />
          {pageData.totalCount > 0 ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-zinc-500">
                Exibindo {firstVisibleRecord}-{lastVisibleRecord} de {pageData.totalCount} registro(s)
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                <DataTablePagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
                <DataTablePageSize
                  value={pageSize}
                  options={EMPLOYEE_PAGE_SIZE_OPTIONS}
                  onChange={handlePageSizeChange}
                />
              </div>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <DrawerForm
        open={drawerOpen}
        title={editingEmployee ? "Editar colaborador" : "Novo colaborador"}
        description="Organize dados pessoais, profissionais e endereço sem concentrar tudo em uma tela gigante."
        onClose={() => setDrawerOpen(false)}
      >
        {managerOptionsError ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {managerOptionsError}
          </div>
        ) : null}
        {managerOptionsLoading ? <LoadingState /> : null}
        {pageData && !managerOptionsLoading ? (
          <EmployeeForm
            initialEmployee={editingEmployee}
            options={{
              departments: pageData.departments,
              positions: pageData.positions,
              employmentTypes: pageData.employmentTypes,
              statuses: pageData.statuses,
              maritalStatuses: pageData.maritalStatuses,
              companyUnits: pageData.companyUnits,
              costCenters: pageData.costCenters,
              managers: managerOptions,
            }}
            onCancel={() => setDrawerOpen(false)}
            onSubmit={async (input) => {
              if (editingEmployee) {
                await updateEmployee(editingEmployee.id, input);
              } else {
                await createEmployee(input);
              }

              await reload();
              await reloadManagerOptions();
              setDrawerOpen(false);
            }}
          />
        ) : null}
      </DrawerForm>

      <DrawerForm
        open={Boolean(terminatingEmployee)}
        title="Registrar desligamento"
        description="Informe data, motivo e valores reais da rescisão para manter o custo registrado."
        onClose={() => setTerminatingEmployee(null)}
      >
        {pageData && terminatingEmployee ? (
          <EmployeeMovementForm
            employees={pageData.employees}
            terminationReasons={pageData.terminationReasons}
            movementCostCategories={pageData.movementCostCategories}
            lockedEmployeeId={terminatingEmployee.id}
            lockedMovementType="termination"
            onCancel={() => setTerminatingEmployee(null)}
            onSubmit={async (input) => {
              await createEmployeeMovement({
                ...input,
                employee_id: terminatingEmployee.id,
                movement_type: "termination",
              });
              setTerminatingEmployee(null);
              await reload();
            }}
          />
        ) : null}
      </DrawerForm>
    </div>
  );
}
