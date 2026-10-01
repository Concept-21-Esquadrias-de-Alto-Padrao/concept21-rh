"use client";

import { BadgeDollarSign, UserMinus, UserPlus } from "lucide-react";
import { useMemo } from "react";

import { CompetenceFilter, MultiSelectFilter } from "@/components/filters";
import { useFilterSearchParams } from "@/hooks/useFilterSearchParams";
import { EmployeeMovementsPanel } from "@/modules/hr/components/EmployeeMovementsPanel";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { MetricCard } from "@/modules/hr/components/MetricCard";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import { listEmployees } from "@/modules/hr/services/employees.service";
import {
  listEmployeeMovementCostCategories,
  listEmployeeMovementsWithSummary,
  type EmployeeMovementFilters,
} from "@/modules/hr/services/movements.service";
import { getCurrentUserAccess, hasMasterRole } from "@/modules/hr/services/auth.service";
import { checkUserPermission } from "@/modules/hr/services/permissions.service";
import { listSettingItems } from "@/modules/hr/services/settings.service";
import type {
  Department,
  Employee,
  EmployeeStatus,
  EmployeeMovementCostCategory,
  EmployeeMovement,
  EmployeeMovementStatus,
  EmployeeMovementType,
  EmploymentType,
  Position,
  TerminationReason,
} from "@/modules/hr/types";
import { getDefaultReferenceMonth, formatCurrencyBRL } from "@/modules/hr/utils/labor-cost-calculations";

interface MovementsPageData {
  movements: EmployeeMovement[];
  summary: {
    admissions: number;
    terminations: number;
    admissionTotal: number;
    terminationTotal: number;
    total: number;
  };
  employees: Employee[];
  departments: Department[];
  positions: Position[];
  employmentTypes: EmploymentType[];
  statuses: EmployeeStatus[];
  terminationReasons: TerminationReason[];
  movementCostCategories: EmployeeMovementCostCategory[];
  canManage: boolean;
  isMaster: boolean;
}

async function loadMovementsPageData(filters: EmployeeMovementFilters): Promise<MovementsPageData> {
  const [
    movementResult,
    employees,
    departments,
    positions,
    employmentTypes,
    statuses,
    terminationReasons,
    movementCostCategories,
    canManage,
    currentUserAccess,
  ] = await Promise.all([
    listEmployeeMovementsWithSummary(filters),
    listEmployees({}),
    listSettingItems("departments"),
    listSettingItems("positions"),
    listSettingItems("employment_types"),
    listSettingItems("employee_statuses"),
    listSettingItems("termination_reasons"),
    listEmployeeMovementCostCategories({ includeInactive: true }),
    checkUserPermission("hr.movements.manage"),
    getCurrentUserAccess(),
  ]);

  return {
    movements: movementResult.movements,
    summary: movementResult.summary,
    employees,
    departments: departments as Department[],
    positions: positions as Position[],
    employmentTypes: employmentTypes as EmploymentType[],
    statuses: statuses as EmployeeStatus[],
    terminationReasons: terminationReasons as TerminationReason[],
    movementCostCategories,
    canManage,
    isMaster: hasMasterRole(currentUserAccess),
  };
}

function monthLabel(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-");

  return `${month}/${year}`;
}

const movementTypeOptions = [
  { value: "admission", label: "Admissões" },
  { value: "termination", label: "Desligamentos" },
] satisfies Array<{ value: EmployeeMovementType; label: string }>;

const movementStatusOptions = [
  { value: "planned", label: "Planejado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
] satisfies Array<{ value: EmployeeMovementStatus; label: string }>;

function filterEnumValues<T extends string>(values: string[], allowedValues: readonly T[]) {
  return values.filter((value): value is T => allowedValues.includes(value as T));
}

export function MovementsPage() {
  const filterParams = useFilterSearchParams();
  const referenceMonth = filterParams.getMonth("competence", getDefaultReferenceMonth().slice(0, 7));
  const movementTypes = filterEnumValues(
    filterParams.getArray("types"),
    movementTypeOptions.map((option) => option.value),
  );
  const departmentIds = filterParams.getArray("departments");
  const employeeIds = filterParams.getArray("employees");
  const statuses = filterEnumValues(
    filterParams.getArray("statuses"),
    movementStatusOptions.map((option) => option.value),
  );
  const filters: EmployeeMovementFilters = {
    referenceMonth,
    movementTypes,
    departmentIds,
    employeeIds,
    statuses,
  };
  const resourceKey = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsyncResource(
    () => loadMovementsPageData(filters),
    `employee-movements-${resourceKey}`,
  );
  const filteredEmployeeOptions = useMemo(
    () =>
      data?.employees.filter(
        (employee) => departmentIds.length === 0 || departmentIds.includes(employee.department_id ?? ""),
      ) ?? [],
    [data?.employees, departmentIds],
  );
  const departmentOptions = useMemo(
    () =>
      data?.departments.map((department) => ({
        value: department.id,
        label: department.name,
      })) ?? [],
    [data?.departments],
  );
  const employeeOptions = useMemo(
    () =>
      filteredEmployeeOptions.map((employee) => ({
        value: employee.id,
        label: employee.full_name,
      })),
    [filteredEmployeeOptions],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Movimentação de pessoas"
        title="Admissões e desligamentos"
        description="Controle de entradas, saídas e custos reais vinculados aos colaboradores."
      />

      <div className="space-y-6">
        <SectionCard title="Filtros">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <CompetenceFilter
              label="Competência"
              value={referenceMonth}
              onChange={(nextReferenceMonth) =>
                filterParams.replaceParams({ competence: nextReferenceMonth }, { resetPage: true })
              }
            />
            <MultiSelectFilter
              label="Tipo"
              ariaLabel="Filtrar movimentações por tipo"
              options={movementTypeOptions}
              values={movementTypes}
              placeholder="Todos"
              selectedLabel={(count) => `${count} tipos`}
              onChange={(values) => filterParams.replaceParams({ types: values }, { resetPage: true })}
            />
            <MultiSelectFilter
              label="Departamento"
              ariaLabel="Filtrar movimentações por departamento"
              options={departmentOptions}
              values={departmentIds}
              placeholder="Todos"
              selectedLabel={(count) => `${count} departamentos`}
              onChange={(values) => {
                filterParams.replaceParams({ departments: values, employees: [] }, { resetPage: true });
              }}
            />
            <MultiSelectFilter
              label="Colaborador"
              ariaLabel="Filtrar movimentações por colaborador"
              options={employeeOptions}
              values={employeeIds}
              placeholder="Todos"
              searchable
              selectedLabel={(count) => `${count} colaboradores`}
              onChange={(values) => filterParams.replaceParams({ employees: values }, { resetPage: true })}
            />
            <MultiSelectFilter
              label="Status"
              ariaLabel="Filtrar movimentações por status"
              options={movementStatusOptions}
              values={statuses}
              placeholder="Todos"
              selectedLabel={(count) => `${count} status`}
              onChange={(values) => filterParams.replaceParams({ statuses: values }, { resetPage: true })}
            />
          </div>
        </SectionCard>

        {loading && !data ? <LoadingState /> : null}
        {error && !data ? <ErrorState message={error} /> : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="Admissões"
                value={data.summary.admissions}
                detail={`Competência ${monthLabel(referenceMonth)}`}
                tone="info"
                icon={UserPlus}
              />
              <MetricCard
                label="Custo admissional"
                value={formatCurrencyBRL(data.summary.admissionTotal)}
                detail="Soma dos itens de admissão"
                tone="info"
                icon={BadgeDollarSign}
              />
              <MetricCard
                label="Desligamentos"
                value={data.summary.terminations}
                detail={`Competência ${monthLabel(referenceMonth)}`}
                tone="neutral"
                icon={UserMinus}
              />
              <MetricCard
                label="Custo rescisório"
                value={formatCurrencyBRL(data.summary.terminationTotal)}
                detail="Soma dos itens de desligamento"
                tone="warning"
                icon={BadgeDollarSign}
              />
              <MetricCard
                label="Custo total"
                value={formatCurrencyBRL(data.summary.total)}
                detail="Admissões + desligamentos"
                tone="success"
                icon={BadgeDollarSign}
              />
            </div>

            <SectionCard title="Movimentos da competência">
              <EmployeeMovementsPanel
                movements={data.movements}
                employees={data.employees}
                departments={data.departments}
                positions={data.positions}
                employmentTypes={data.employmentTypes}
                statuses={data.statuses}
                terminationReasons={data.terminationReasons}
                movementCostCategories={data.movementCostCategories}
                canManage={data.canManage}
                canDeleteTerminations={data.isMaster}
                onChanged={reload}
              />
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
