"use client";

import {
  BadgeDollarSign,
  Banknote,
  Calculator,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  HandCoins,
  ReceiptText,
  RotateCcw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { CompetenceFilter, MultiSelectFilter } from "@/components/filters";
import { useFilterSearchParams } from "@/hooks/useFilterSearchParams";
import {
  DonutChartCard,
  HorizontalBarChartCard,
  type ChartDatum,
} from "@/modules/hr/components/DashboardCharts";
import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { MetricCard } from "@/modules/hr/components/MetricCard";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import {
  getLaborCostDashboard,
  type DepartmentLaborCost,
  type EmployeeCostSummary,
} from "@/modules/hr/services/labor-costs.service";
import { listEmployees } from "@/modules/hr/services/employees.service";
import { listSettingItems } from "@/modules/hr/services/settings.service";
import type {
  Department,
  Employee,
  EmployeeStatus,
  EmploymentType,
  MonthlyEmployeeCostStatus,
} from "@/modules/hr/types";
import {
  formatCurrencyBRL,
  formatReferenceMonth,
  getDefaultReferenceMonth,
} from "@/modules/hr/utils/labor-cost-calculations";

interface LaborCostDashboardData {
  dashboard: Awaited<ReturnType<typeof getLaborCostDashboard>>;
  departments: Department[];
  employmentTypes: EmploymentType[];
  statuses: EmployeeStatus[];
  employees: Employee[];
}

interface LaborCostDashboardFilters {
  referenceMonth: string;
  employeeIds?: string[];
  departmentIds?: string[];
  employmentTypeIds?: string[];
  statusIds?: string[];
}

const closingStatusLabels: Record<MonthlyEmployeeCostStatus, string> = {
  estimated: "Estimado",
  reviewing: "Em revisão",
  closed: "Fechado",
  reopened: "Reaberto",
  cancelled: "Cancelado",
};

const costCompositionColors = {
  baseSalary: "#111316",
  benefits: "#0284c7",
  allowances: "#10b981",
  charges: "#f97316",
  provisions: "#8b8f99",
  variableEvents: "#0f766e",
};

async function loadLaborCostDashboardData(
  filters: LaborCostDashboardFilters,
): Promise<LaborCostDashboardData> {
  const [dashboard, departments, employmentTypes, statuses, employees] = await Promise.all([
    getLaborCostDashboard(filters.referenceMonth, {
      employeeIds: filters.employeeIds,
      departmentIds: filters.departmentIds,
      employmentTypeIds: filters.employmentTypeIds,
      statusIds: filters.statusIds,
    }),
    listSettingItems("departments"),
    listSettingItems("employment_types"),
    listSettingItems("employee_statuses"),
    listEmployees(),
  ]);

  return {
    dashboard,
    departments: departments as Department[],
    employmentTypes: employmentTypes as EmploymentType[],
    statuses: statuses as EmployeeStatus[],
    employees,
  };
}

function getClosingStatusLabel(status?: MonthlyEmployeeCostStatus | null) {
  return status ? closingStatusLabels[status] : "Em aberto";
}

function buildCostCompositionData(dashboard: LaborCostDashboardData["dashboard"]): ChartDatum[] {
  return [
    { label: "Salários-base", value: dashboard.baseSalaryTotal, color: costCompositionColors.baseSalary },
    { label: "Benefícios", value: dashboard.benefitsTotal, color: costCompositionColors.benefits },
    { label: "Ajudas", value: dashboard.allowancesTotal, color: costCompositionColors.allowances },
    { label: "Encargos", value: dashboard.employerChargesTotal, color: costCompositionColors.charges },
    { label: "Provisões", value: dashboard.provisionsTotal, color: costCompositionColors.provisions },
    { label: "Eventos variáveis", value: dashboard.variableEventsTotal, color: costCompositionColors.variableEvents },
  ];
}

function hasAnyFilter(filters: {
  employeeIds: string[];
  departmentIds: string[];
  employmentTypeIds: string[];
  statusIds: string[];
}) {
  return Boolean(
    filters.employeeIds.length > 0 ||
      filters.departmentIds.length > 0 ||
      filters.employmentTypeIds.length > 0 ||
      filters.statusIds.length > 0,
  );
}

export function LaborCostDashboardPanel() {
  const filterParams = useFilterSearchParams();
  const referenceMonth = filterParams.getMonth("competence", getDefaultReferenceMonth().slice(0, 7));
  const employeeIds = filterParams.getArray("employees");
  const departmentIds = filterParams.getArray("departments");
  const employmentTypeIds = filterParams.getArray("employmentTypes");
  const statusIds = filterParams.getArray("statuses");
  const activeFilters = { employeeIds, departmentIds, employmentTypeIds, statusIds };
  const resourceKey = `payroll-${referenceMonth}-${employeeIds.join(",")}-${departmentIds.join(",")}-${employmentTypeIds.join(",")}-${statusIds.join(",")}`;
  const { data, loading, error } = useAsyncResource(
    () =>
      loadLaborCostDashboardData({
        referenceMonth,
        employeeIds,
        departmentIds,
        employmentTypeIds,
        statusIds,
      }),
    resourceKey,
  );

  const filteredEmployeeOptions =
    data?.employees.filter(
      (employee) =>
        (departmentIds.length === 0 || departmentIds.includes(employee.department_id ?? "")) &&
        (employmentTypeIds.length === 0 || employmentTypeIds.includes(employee.employment_type_id ?? "")) &&
        (statusIds.length === 0 || statusIds.includes(employee.status_id ?? "")),
    ) ?? [];
  const employeeFilterOptions = filteredEmployeeOptions.map((employee) => ({
    value: employee.id,
    label: employee.full_name,
  }));
  const departmentFilterOptions = useMemo(
    () =>
      data?.departments.map((department) => ({
        value: department.id,
        label: department.name,
      })) ?? [],
    [data?.departments],
  );
  const employmentTypeFilterOptions = useMemo(
    () =>
      data?.employmentTypes.map((item) => ({
        value: item.id,
        label: item.name,
      })) ?? [],
    [data?.employmentTypes],
  );
  const statusFilterOptions = useMemo(
    () =>
      data?.statuses.map((item) => ({
        value: item.id,
        label: item.name,
      })) ?? [],
    [data?.statuses],
  );

  const costComposition = useMemo(
    () => (data ? buildCostCompositionData(data.dashboard) : []),
    [data],
  );

  const topEmployeeCostData = useMemo<ChartDatum[]>(
    () =>
      data?.dashboard.topEmployeesByCost.map((employee) => ({
        label: employee.employeeName,
        value: employee.totalCompanyCost,
        detail: employee.departmentName,
      })) ?? [],
    [data?.dashboard.topEmployeesByCost],
  );

  const departmentCostData = useMemo<ChartDatum[]>(
    () =>
      data?.dashboard.departmentCosts.map((department) => ({
        label: department.departmentName,
        value: department.totalCompanyCost,
        detail: `${department.employeeCount} colaborador${department.employeeCount === 1 ? "" : "es"}`,
      })) ?? [],
    [data?.dashboard.departmentCosts],
  );

  const departmentColumns = useMemo<Array<DataTableColumn<DepartmentLaborCost>>>(
    () => [
      { key: "department", header: "Departamento", render: (item) => item.departmentName },
      { key: "employees", header: "Colaboradores", render: (item) => item.employeeCount },
      { key: "total", header: "Custo total", render: (item) => formatCurrencyBRL(item.totalCompanyCost) },
      { key: "salary", header: "Salários-base", render: (item) => formatCurrencyBRL(item.baseSalaryTotal) },
      {
        key: "benefits",
        header: "Benefícios e ajudas",
        render: (item) => formatCurrencyBRL(item.benefitsAndAllowancesTotal),
      },
      {
        key: "charges",
        header: "Encargos e provisões",
        render: (item) => formatCurrencyBRL(item.chargesAndProvisionsTotal),
      },
      {
        key: "average",
        header: "Média",
        render: (item) => formatCurrencyBRL(item.averageCostPerEmployee),
      },
    ],
    [],
  );

  const employeeColumns = useMemo<Array<DataTableColumn<EmployeeCostSummary>>>(
    () => [
      {
        key: "employee",
        header: "Colaborador",
        render: (item) => (
          <div>
            <p className="font-semibold text-zinc-950">{item.employeeName}</p>
            <p className="font-mono text-xs text-zinc-500">{item.employeeNumber}</p>
          </div>
        ),
      },
      {
        key: "department",
        header: "Setor / cargo",
        render: (item) => (
          <div>
            <p className="text-zinc-950">{item.departmentName}</p>
            <p className="text-xs text-zinc-500">{item.positionName}</p>
          </div>
        ),
      },
      {
        key: "employment",
        header: "Vínculo / status",
        render: (item) => (
          <div className="space-y-1">
            <p className="text-zinc-950">{item.employmentTypeName}</p>
            <StatusBadge label={item.statusName} status={item.statusName} />
          </div>
        ),
      },
      { key: "salary", header: "Salário-base", render: (item) => formatCurrencyBRL(item.baseSalary) },
      {
        key: "benefits",
        header: "Benefícios / ajudas",
        render: (item) => formatCurrencyBRL(item.benefitsTotal + item.allowancesTotal),
      },
      {
        key: "charges",
        header: "Encargos",
        render: (item) => formatCurrencyBRL(item.employerChargesTotal),
      },
      {
        key: "provisions",
        header: "Provisões",
        render: (item) => formatCurrencyBRL(item.provisionsTotal),
      },
      {
        key: "events",
        header: "Eventos variáveis",
        render: (item) => formatCurrencyBRL(item.variableEventsTotal),
      },
      {
        key: "total",
        header: "Custo total",
        render: (item) => <span className="font-semibold text-zinc-950">{formatCurrencyBRL(item.totalCompanyCost)}</span>,
      },
      {
        key: "hour",
        header: "Custo hora",
        render: (item) => formatCurrencyBRL(item.contractualHourCost),
      },
      {
        key: "closing",
        header: "Fechamento",
        render: (item) => (
          <StatusBadge label={getClosingStatusLabel(item.closingStatus)} status={item.closingStatus ?? "pending"} />
        ),
      },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <Link
            href={`/rh/colaboradores/${item.employeeId}`}
            className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-[#f97316] hover:text-[#f97316]"
            title="Abrir prontuário do colaborador"
          >
            <Eye className="h-4 w-4" />
          </Link>
        ),
      },
    ],
    [],
  );

  function clearFilters() {
    filterParams.clearParams(["employees", "departments", "employmentTypes", "statuses", "page"]);
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title="Filtros da folha"
        description={
          data
            ? `Competência em análise: ${formatReferenceMonth(data.dashboard.referenceMonth)}`
            : "Selecione a competência e os recortes da folha."
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_1.2fr_1fr_1fr_1fr_auto]">
          <CompetenceFilter
            label="Competência"
            value={referenceMonth}
            onChange={(nextReferenceMonth) =>
              filterParams.replaceParams({ competence: nextReferenceMonth }, { resetPage: true })
            }
          />

          <MultiSelectFilter
            label="Colaborador"
            ariaLabel="Filtrar folha por colaborador"
            options={employeeFilterOptions}
            values={employeeIds}
            placeholder="Todos"
            searchable
            selectedLabel={(count) => `${count} colaboradores`}
            onChange={(nextEmployeeIds) =>
              filterParams.replaceParams({ employees: nextEmployeeIds }, { resetPage: true })
            }
          />

          <MultiSelectFilter
            label="Departamento"
            ariaLabel="Filtrar folha por departamento"
            options={departmentFilterOptions}
            values={departmentIds}
            placeholder="Todos"
            selectedLabel={(count) => `${count} departamentos`}
            onChange={(nextDepartmentIds) => {
              filterParams.replaceParams(
                { departments: nextDepartmentIds, employees: [] },
                { resetPage: true },
              );
            }}
          />

          <MultiSelectFilter
            label="Tipo de vínculo"
            ariaLabel="Filtrar folha por tipo de vínculo"
            options={employmentTypeFilterOptions}
            values={employmentTypeIds}
            placeholder="Todos"
            selectedLabel={(count) => `${count} vínculos`}
            onChange={(nextEmploymentTypeIds) => {
              filterParams.replaceParams(
                { employmentTypes: nextEmploymentTypeIds, employees: [] },
                { resetPage: true },
              );
            }}
          />

          <MultiSelectFilter
            label="Status"
            ariaLabel="Filtrar folha por status"
            options={statusFilterOptions}
            values={statusIds}
            placeholder="Todos"
            selectedLabel={(count) => `${count} status`}
            onChange={(nextStatusIds) => {
              filterParams.replaceParams({ statuses: nextStatusIds, employees: [] }, { resetPage: true });
            }}
          />

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasAnyFilter(activeFilters)}
              className="grid h-10 w-10 place-items-center rounded-md border border-zinc-300 text-zinc-700 transition hover:border-[#f97316] hover:text-[#f97316] disabled:cursor-not-allowed disabled:opacity-50"
              title="Limpar filtros"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SectionCard>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Custo total da folha"
              value={formatCurrencyBRL(data.dashboard.totalEstimatedCost)}
              detail={`${data.dashboard.employeeCount} colaborador${data.dashboard.employeeCount === 1 ? "" : "es"}`}
              tone="warning"
              icon={BadgeDollarSign}
            />
            <MetricCard
              label="Custo médio por colaborador"
              value={formatCurrencyBRL(data.dashboard.averageCostPerEmployee)}
              detail="Competência selecionada"
              tone="info"
              icon={Users}
            />
            <MetricCard
              label="Salários-base"
              value={formatCurrencyBRL(data.dashboard.baseSalaryTotal)}
              detail="Remuneração base"
              tone="neutral"
              icon={Banknote}
            />
            <MetricCard
              label="Encargos e provisões"
              value={formatCurrencyBRL(data.dashboard.employerChargesTotal + data.dashboard.provisionsTotal)}
              detail="Valores vinculados aos colaboradores"
              tone="warning"
              icon={ReceiptText}
            />
            <MetricCard
              label="Benefícios e ajudas"
              value={formatCurrencyBRL(data.dashboard.benefitsTotal + data.dashboard.allowancesTotal)}
              detail="Benefícios, auxílios e ajudas"
              tone="success"
              icon={HandCoins}
            />
            <MetricCard
              label="Eventos variáveis"
              value={formatCurrencyBRL(data.dashboard.variableEventsTotal)}
              detail="Lançamentos da competência"
              tone="info"
              icon={Calculator}
            />
            <MetricCard
              label="Custo total fechado"
              value={formatCurrencyBRL(data.dashboard.totalClosedCost)}
              detail="Competências conferidas"
              tone="neutral"
              icon={CheckCircle2}
            />
            <MetricCard
              label="Custo médio por hora"
              value={formatCurrencyBRL(data.dashboard.averageContractualHourCost)}
              detail="Base contratual"
              tone="info"
              icon={Clock3}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <DonutChartCard
              title="Composição do custo"
              description="Distribuição dos componentes que formam a folha."
              data={costComposition}
              valueFormatter={formatCurrencyBRL}
            />
            <HorizontalBarChartCard
              title="Maiores custos por colaborador"
              description="Colaboradores com maior custo na competência."
              data={topEmployeeCostData}
              valueFormatter={formatCurrencyBRL}
            />
          </div>

          <HorizontalBarChartCard
            title="Custo por departamento"
            description="Comparação dos setores com maior impacto na folha."
            data={departmentCostData}
            valueFormatter={formatCurrencyBRL}
          />

          <SectionCard
            title="Folha por colaborador"
            description={`${data.dashboard.employeeCosts.length} registro(s) encontrado(s)`}
            actions={
              <span className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                <Filter className="h-3.5 w-3.5" />
                Dados sensíveis
              </span>
            }
          >
            <DataTable
              data={data.dashboard.employeeCosts}
              columns={employeeColumns}
              getRowKey={(item) => item.employeeId}
              emptyState={<EmptyState title="Nenhum custo encontrado" />}
            />
          </SectionCard>

          <SectionCard title="Resumo por departamento">
            <DataTable
              data={data.dashboard.departmentCosts}
              columns={departmentColumns}
              getRowKey={(item) => item.departmentId ?? item.departmentName}
              emptyState={<EmptyState title="Nenhum custo por departamento" />}
            />
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
