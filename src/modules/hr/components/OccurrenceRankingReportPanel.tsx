"use client";

import { Download, FileSearch, RotateCcw, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { MultiSelectFilter } from "@/components/filters";
import { useFilterSearchParams } from "@/hooks/useFilterSearchParams";
import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import {
  downloadOccurrenceRankingReportPdf,
  type OccurrenceRankingPdfReport,
} from "@/modules/hr/services/occurrence-ranking-report.service";
import type { Employee, EmployeeOccurrence, OccurrenceType } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { formatDate, formatFloatingDateTime } from "@/modules/hr/utils/format";

interface OccurrenceRankingReportPanelProps {
  occurrences: EmployeeOccurrence[];
  employees: Employee[];
  occurrenceTypes: OccurrenceType[];
}

interface OccurrenceRankingFilters {
  employeeIds: string[];
  departmentIds: string[];
  employeeStatusIds: string[];
  occurrenceTypeIds: string[];
  startDate: string;
  endDate: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface EmployeeStatusOption {
  id: string;
  name: string;
}

interface OccurrenceRankingRow {
  rank: number;
  employeeId: string;
  employeeName: string;
  employeeNumber?: string | null;
  departmentName: string;
  employeeStatusName: string;
  employeeStatusKey?: string | null;
  occurrenceCount: number;
  lastOccurrenceAt?: string | null;
  typeSummary: string;
  percentage: number;
}

interface RankingAccumulator {
  employeeId: string;
  employeeName: string;
  employeeNumber?: string | null;
  departmentName: string;
  employeeStatusName: string;
  employeeStatusKey?: string | null;
  occurrenceCount: number;
  lastOccurrenceAt?: string | null;
  typeCounts: Map<string, number>;
}

const NO_DEPARTMENT_FILTER = "__no_department__";
const NO_EMPLOYEE_STATUS_FILTER = "__no_status__";
const rankingFilterParamKeys = [
  "rankingDepartments",
  "rankingStatuses",
  "rankingEmployees",
  "rankingOccurrenceTypes",
  "rankingDateFrom",
  "rankingDateTo",
  "page",
];

type EmployeeDepartmentInfo = Pick<Employee, "department" | "department_id">;
type EmployeeStatusInfo = Pick<Employee, "status" | "status_id">;

function toDateInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function createDefaultRankingFilters(): OccurrenceRankingFilters {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    employeeIds: [],
    departmentIds: [],
    employeeStatusIds: [],
    occurrenceTypeIds: [],
    startDate: toDateInputValue(firstDayOfMonth),
    endDate: toDateInputValue(today),
  };
}

function getOccurrenceStartDate(occurrence: EmployeeOccurrence) {
  return occurrence.start_date ?? occurrence.occurred_at?.slice(0, 10) ?? "";
}

function getOccurrenceEndDate(occurrence: EmployeeOccurrence) {
  return occurrence.end_date ?? getOccurrenceStartDate(occurrence);
}

function getOccurrenceDepartmentId(
  occurrence: EmployeeOccurrence,
  employeesById: Map<string, Employee>,
) {
  return (
    occurrence.department_id ??
    occurrence.employee?.department_id ??
    employeesById.get(occurrence.employee_id)?.department_id ??
    null
  );
}

function getOccurrenceDepartmentName(occurrence: EmployeeOccurrence, employee?: EmployeeDepartmentInfo | null) {
  return occurrence.department?.name ?? occurrence.employee?.department?.name ?? employee?.department?.name ?? "Sem departamento";
}

function addDepartmentOption(options: Map<string, DepartmentOption>, id?: string | null, name?: string | null) {
  if (!id) {
    return;
  }

  options.set(id, {
    id,
    name: name || "Departamento não localizado",
  });
}

function addEmployeeStatusOption(options: Map<string, EmployeeStatusOption>, id?: string | null, name?: string | null) {
  if (!id) {
    return;
  }

  options.set(id, {
    id,
    name: name || "Status não localizado",
  });
}

function buildDepartmentOptions(employees: Employee[], occurrences: EmployeeOccurrence[]) {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const options = new Map<string, DepartmentOption>();
  let hasNoDepartment = false;

  employees.forEach((employee) => {
    if (employee.department_id) {
      addDepartmentOption(options, employee.department_id, employee.department?.name);
      return;
    }

    hasNoDepartment = true;
  });

  occurrences.forEach((occurrence) => {
    const employee = employeesById.get(occurrence.employee_id);
    const departmentId = getOccurrenceDepartmentId(occurrence, employeesById);

    if (!departmentId) {
      hasNoDepartment = true;
      return;
    }

    addDepartmentOption(options, departmentId, getOccurrenceDepartmentName(occurrence, employee));
  });

  const sortedOptions = Array.from(options.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR"),
  );

  return hasNoDepartment
    ? [...sortedOptions, { id: NO_DEPARTMENT_FILTER, name: "Sem departamento" }]
    : sortedOptions;
}

function buildEmployeeStatusOptions(employees: Employee[]) {
  const options = new Map<string, EmployeeStatusOption>();
  let hasNoStatus = false;

  employees.forEach((employee) => {
    if (employee.status_id) {
      addEmployeeStatusOption(options, employee.status_id, employee.status?.name);
      return;
    }

    hasNoStatus = true;
  });

  const sortedOptions = Array.from(options.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR"),
  );

  return hasNoStatus
    ? [...sortedOptions, { id: NO_EMPLOYEE_STATUS_FILTER, name: "Sem status" }]
    : sortedOptions;
}

function employeeMatchesDepartment(employee: Employee, departmentIds: string[]) {
  if (departmentIds.length === 0) {
    return true;
  }

  if (!employee.department_id) {
    return departmentIds.includes(NO_DEPARTMENT_FILTER);
  }

  return departmentIds.includes(employee.department_id);
}

function employeeMatchesStatus(employee: Employee, employeeStatusIds: string[]) {
  if (employeeStatusIds.length === 0) {
    return true;
  }

  if (!employee.status_id) {
    return employeeStatusIds.includes(NO_EMPLOYEE_STATUS_FILTER);
  }

  return employeeStatusIds.includes(employee.status_id);
}

function getOccurrenceEmployeeStatusId(
  occurrence: EmployeeOccurrence,
  employeesById: Map<string, Employee>,
) {
  return employeesById.get(occurrence.employee_id)?.status_id ?? null;
}

function getEmployeeStatusName(employee?: EmployeeStatusInfo | null) {
  return employee?.status?.name ?? "Sem status";
}

function getEmployeeStatusKey(employee?: EmployeeStatusInfo | null) {
  return employee?.status?.key ?? null;
}

function occurrenceMatchesPeriod(
  occurrence: EmployeeOccurrence,
  startDate: string,
  endDate: string,
) {
  const occurrenceStart = getOccurrenceStartDate(occurrence);
  const occurrenceEnd = getOccurrenceEndDate(occurrence);

  if (!occurrenceStart) {
    return false;
  }

  if (startDate && occurrenceEnd < startDate) {
    return false;
  }

  if (endDate && occurrenceStart > endDate) {
    return false;
  }

  return true;
}

function formatRankingPeriod(filters: OccurrenceRankingFilters) {
  if (filters.startDate && filters.endDate) {
    return `${formatDate(filters.startDate)} a ${formatDate(filters.endDate)}`;
  }

  if (filters.startDate) {
    return `A partir de ${formatDate(filters.startDate)}`;
  }

  if (filters.endDate) {
    return `Até ${formatDate(filters.endDate)}`;
  }

  return "Todo o histórico";
}

function formatTypeSummary(typeCounts: Map<string, number>) {
  const [firstType, secondType] = Array.from(typeCounts.entries()).sort(
    ([firstName, firstCount], [secondName, secondCount]) =>
      secondCount - firstCount || firstName.localeCompare(secondName, "pt-BR"),
  );

  return [firstType, secondType]
    .filter(Boolean)
    .map(([name, count]) => `${name} (${count})`)
    .join(", ") || "-";
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatOccurrenceCount(count: number) {
  return `${count} ocorrência${count === 1 ? "" : "s"}`;
}

function formatEmployeeOption(employee?: Employee | null) {
  if (!employee) {
    return "Todos os colaboradores";
  }

  return `${employee.full_name}${employee.employee_number ? ` (${employee.employee_number})` : ""}`;
}

function getDepartmentFilterLabel(filters: OccurrenceRankingFilters, departmentOptions: DepartmentOption[]) {
  if (filters.departmentIds.length === 0) {
    return "Todos os departamentos";
  }

  const selectedNames = departmentOptions
    .filter((department) => filters.departmentIds.includes(department.id))
    .map((department) => department.name);

  return selectedNames.length > 0 ? selectedNames.join(", ") : "Departamentos não localizados";
}

function getEmployeeStatusFilterLabel(filters: OccurrenceRankingFilters, statusOptions: EmployeeStatusOption[]) {
  if (filters.employeeStatusIds.length === 0) {
    return "Todos os status";
  }

  const selectedNames = statusOptions
    .filter((status) => filters.employeeStatusIds.includes(status.id))
    .map((status) => status.name);

  return selectedNames.length > 0 ? selectedNames.join(", ") : "Status não localizados";
}

function getEmployeeFilterLabel(filters: OccurrenceRankingFilters, employees: Employee[]) {
  if (filters.employeeIds.length === 0) {
    return "Todos os colaboradores";
  }

  const selectedNames = employees
    .filter((employee) => filters.employeeIds.includes(employee.id))
    .map(formatEmployeeOption);

  return selectedNames.length > 0 ? selectedNames.join(", ") : "Colaboradores não localizados";
}

function getOccurrenceTypeFilterLabel(filters: OccurrenceRankingFilters, occurrenceTypes: OccurrenceType[]) {
  if (filters.occurrenceTypeIds.length === 0) {
    return "Todos os tipos";
  }

  const selectedTypes = occurrenceTypes
    .filter((type) => filters.occurrenceTypeIds.includes(type.id))
    .map((type) => type.name);

  return selectedTypes.length > 0 ? selectedTypes.join(", ") : "Tipos não localizados";
}

function isLaterOccurrence(candidate?: string | null, current?: string | null) {
  if (!candidate) {
    return false;
  }

  if (!current) {
    return true;
  }

  return new Date(candidate).getTime() > new Date(current).getTime();
}

function filterOccurrencesForRanking(
  occurrences: EmployeeOccurrence[],
  employees: Employee[],
  filters: OccurrenceRankingFilters,
) {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));

  return occurrences.filter((occurrence) => {
    if (filters.employeeIds.length > 0 && !filters.employeeIds.includes(occurrence.employee_id)) {
      return false;
    }

    if (filters.departmentIds.length > 0) {
      const departmentId = getOccurrenceDepartmentId(occurrence, employeesById);

      if (!departmentId && !filters.departmentIds.includes(NO_DEPARTMENT_FILTER)) {
        return false;
      }

      if (departmentId && !filters.departmentIds.includes(departmentId)) {
        return false;
      }
    }

    if (filters.employeeStatusIds.length > 0) {
      const employeeStatusId = getOccurrenceEmployeeStatusId(occurrence, employeesById);

      if (!employeeStatusId && !filters.employeeStatusIds.includes(NO_EMPLOYEE_STATUS_FILTER)) {
        return false;
      }

      if (employeeStatusId && !filters.employeeStatusIds.includes(employeeStatusId)) {
        return false;
      }
    }

    if (
      filters.occurrenceTypeIds.length > 0 &&
      !filters.occurrenceTypeIds.includes(occurrence.occurrence_type_id)
    ) {
      return false;
    }

    return occurrenceMatchesPeriod(occurrence, filters.startDate, filters.endDate);
  });
}

function buildOccurrenceRankingRows(
  occurrences: EmployeeOccurrence[],
  employees: Employee[],
) {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const rowsByEmployee = new Map<string, RankingAccumulator>();

  occurrences.forEach((occurrence) => {
    const employeeFromList = employeesById.get(occurrence.employee_id);
    const employee = occurrence.employee ?? employeeFromList;
    const employeeId = occurrence.employee_id;
    const employeeName = employee?.full_name ?? "Colaborador não localizado";
    const employeeNumber = employee?.employee_number ?? null;
    const departmentName = getOccurrenceDepartmentName(occurrence, employee);
    const employeeStatusName = getEmployeeStatusName(employeeFromList);
    const employeeStatusKey = getEmployeeStatusKey(employeeFromList);
    const typeName = occurrence.occurrence_type?.name ?? "Tipo não informado";
    const current = rowsByEmployee.get(employeeId) ?? {
      employeeId,
      employeeName,
      employeeNumber,
      departmentName,
      employeeStatusName,
      employeeStatusKey,
      occurrenceCount: 0,
      lastOccurrenceAt: null,
      typeCounts: new Map<string, number>(),
    };

    current.occurrenceCount += 1;
    current.typeCounts.set(typeName, (current.typeCounts.get(typeName) ?? 0) + 1);

    if (isLaterOccurrence(occurrence.occurred_at, current.lastOccurrenceAt)) {
      current.lastOccurrenceAt = occurrence.occurred_at;
    }

    rowsByEmployee.set(employeeId, current);
  });

  return Array.from(rowsByEmployee.values())
    .sort(
      (first, second) =>
        second.occurrenceCount - first.occurrenceCount ||
        first.employeeName.localeCompare(second.employeeName, "pt-BR"),
    )
    .map<OccurrenceRankingRow>((row, index) => ({
      rank: index + 1,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeNumber: row.employeeNumber,
      departmentName: row.departmentName,
      employeeStatusName: row.employeeStatusName,
      employeeStatusKey: row.employeeStatusKey,
      occurrenceCount: row.occurrenceCount,
      lastOccurrenceAt: row.lastOccurrenceAt,
      typeSummary: formatTypeSummary(row.typeCounts),
      percentage: occurrences.length > 0 ? (row.occurrenceCount / occurrences.length) * 100 : 0,
    }));
}

function getBarWidth(row: OccurrenceRankingRow, maxOccurrences: number) {
  if (maxOccurrences <= 0) {
    return "0%";
  }

  return `${Math.max((row.occurrenceCount / maxOccurrences) * 100, 8)}%`;
}

export function OccurrenceRankingReportPanel({
  occurrences,
  employees,
  occurrenceTypes,
}: OccurrenceRankingReportPanelProps) {
  const filterParams = useFilterSearchParams();
  const defaultRankingFilters = useMemo(() => createDefaultRankingFilters(), []);
  const filters: OccurrenceRankingFilters = {
    employeeIds: filterParams.getArray("rankingEmployees"),
    departmentIds: filterParams.getArray("rankingDepartments"),
    employeeStatusIds: filterParams.getArray("rankingStatuses"),
    occurrenceTypeIds: filterParams.getArray("rankingOccurrenceTypes"),
    startDate: filterParams.getDate("rankingDateFrom", defaultRankingFilters.startDate),
    endDate: filterParams.getDate("rankingDateTo", defaultRankingFilters.endDate),
  };
  const [appliedFilters, setAppliedFilters] = useState<OccurrenceRankingFilters | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const departmentOptions = useMemo(
    () => buildDepartmentOptions(employees, occurrences),
    [employees, occurrences],
  );
  const employeeStatusOptions = useMemo(
    () => buildEmployeeStatusOptions(employees),
    [employees],
  );
  const employeeOptions = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employeeMatchesDepartment(employee, filters.departmentIds) &&
          employeeMatchesStatus(employee, filters.employeeStatusIds),
      ),
    [employees, filters.departmentIds, filters.employeeStatusIds],
  );
  const departmentFilterOptions = useMemo(
    () =>
      departmentOptions.map((department) => ({
        value: department.id,
        label: department.name,
      })),
    [departmentOptions],
  );
  const employeeStatusFilterOptions = useMemo(
    () =>
      employeeStatusOptions.map((status) => ({
        value: status.id,
        label: status.name,
      })),
    [employeeStatusOptions],
  );
  const employeeFilterOptions = useMemo(
    () =>
      employeeOptions.map((employee) => ({
        value: employee.id,
        label: formatEmployeeOption(employee),
      })),
    [employeeOptions],
  );
  const occurrenceTypeFilterOptions = useMemo(
    () =>
      occurrenceTypes.map((type) => ({
        value: type.id,
        label: type.name,
      })),
    [occurrenceTypes],
  );
  const filteredOccurrences = useMemo(
    () => (appliedFilters ? filterOccurrencesForRanking(occurrences, employees, appliedFilters) : []),
    [appliedFilters, employees, occurrences],
  );
  const rankingRows = useMemo(
    () => buildOccurrenceRankingRows(filteredOccurrences, employees),
    [employees, filteredOccurrences],
  );
  const topRankingRows = rankingRows.slice(0, 5);
  const maxOccurrences = rankingRows[0]?.occurrenceCount ?? 0;
  const rankingPdfReport = useMemo<OccurrenceRankingPdfReport | null>(() => {
    if (!appliedFilters) {
      return null;
    }

    return {
      generatedAt: new Date().toISOString(),
      periodLabel: formatRankingPeriod(appliedFilters),
      filters: {
        departmentName: getDepartmentFilterLabel(appliedFilters, departmentOptions),
        employeeStatusName: getEmployeeStatusFilterLabel(appliedFilters, employeeStatusOptions),
        employeeName: getEmployeeFilterLabel(appliedFilters, employees),
        occurrenceTypeNames: getOccurrenceTypeFilterLabel(appliedFilters, occurrenceTypes),
      },
      summary: {
        occurrenceCount: filteredOccurrences.length,
        employeeCount: rankingRows.length,
        maxIndividualOccurrences: rankingRows[0]?.occurrenceCount ?? 0,
      },
      rows: rankingRows,
    };
  }, [
    appliedFilters,
    departmentOptions,
    employeeStatusOptions,
    employees,
    filteredOccurrences.length,
    occurrenceTypes,
    rankingRows,
  ]);

  const columns = useMemo<Array<DataTableColumn<OccurrenceRankingRow>>>(
    () => [
      {
        key: "rank",
        header: "#",
        className: "w-16",
        render: (item) => (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 text-sm font-bold text-zinc-800">
            {item.rank}º
          </span>
        ),
      },
      {
        key: "employee",
        header: "Colaborador",
        render: (item) => (
          <div>
            <p className="font-medium text-zinc-950">{item.employeeName}</p>
            {item.employeeNumber ? <p className="text-xs text-zinc-500">Matrícula {item.employeeNumber}</p> : null}
          </div>
        ),
      },
      {
        key: "occurrenceCount",
        header: "Ocorrências",
        render: (item) => (
          <div className="flex min-w-44 items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-[#f97316]"
                style={{ width: getBarWidth(item, maxOccurrences) }}
              />
            </div>
            <span className="w-8 text-right font-semibold text-zinc-950">{item.occurrenceCount}</span>
          </div>
        ),
      },
      { key: "department", header: "Departamento", render: (item) => item.departmentName },
      {
        key: "employeeStatus",
        header: "Status",
        render: (item) => <StatusBadge label={item.employeeStatusName} status={item.employeeStatusKey} />,
      },
      { key: "typeSummary", header: "Tipo mais frequente", render: (item) => item.typeSummary },
      {
        key: "lastOccurrenceAt",
        header: "Última ocorrência",
        render: (item) => formatFloatingDateTime(item.lastOccurrenceAt),
      },
      { key: "percentage", header: "Participação", render: (item) => formatPercent(item.percentage) },
    ],
    [maxOccurrences],
  );

  function setFilter<K extends keyof OccurrenceRankingFilters>(key: K, value: OccurrenceRankingFilters[K]) {
    const paramByFilterKey: Record<keyof OccurrenceRankingFilters, string> = {
      employeeIds: "rankingEmployees",
      departmentIds: "rankingDepartments",
      employeeStatusIds: "rankingStatuses",
      occurrenceTypeIds: "rankingOccurrenceTypes",
      startDate: "rankingDateFrom",
      endDate: "rankingDateTo",
    };

    filterParams.replaceParams({ [paramByFilterKey[key]]: value }, { resetPage: true });
  }

  function clearMessages() {
    setValidationError(null);
    setActionError(null);
    setSuccessMessage(null);
  }

  function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setValidationError("A data inicial não pode ser maior que a data final.");
      setAppliedFilters(null);
      return;
    }

    setAppliedFilters(filters);
  }

  function handleReset() {
    filterParams.clearParams(rankingFilterParamKeys);
    setAppliedFilters(null);
    clearMessages();
  }

  async function handleDownloadPdf() {
    if (!rankingPdfReport) {
      return;
    }

    clearMessages();
    setDownloadingPdf(true);

    try {
      await downloadOccurrenceRankingReportPdf({
        ...rankingPdfReport,
        generatedAt: new Date().toISOString(),
      });
      setSuccessMessage("PDF do ranking gerado com sucesso.");
    } catch (error) {
      setActionError(toUserFriendlyErrorMessage(error, "Não foi possível gerar o PDF do ranking."));
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title="Ranking de colaboradores por ocorrências"
        description="Classificação por volume de ocorrências conforme colaborador, departamento, tipos e período selecionados."
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_minmax(220px,1.2fr)_180px_180px_auto]">
            <MultiSelectFilter
              label="Departamento"
              ariaLabel="Filtrar ranking por departamento"
              options={departmentFilterOptions}
              values={filters.departmentIds}
              placeholder="Todos"
              selectedLabel={(count) => `${count} departamentos`}
              onChange={(departmentIds) =>
                filterParams.replaceParams(
                  { rankingDepartments: departmentIds, rankingEmployees: [] },
                  { resetPage: true },
                )
              }
            />

            <MultiSelectFilter
              label="Status do colaborador"
              ariaLabel="Filtrar ranking por status do colaborador"
              options={employeeStatusFilterOptions}
              values={filters.employeeStatusIds}
              placeholder="Todos"
              selectedLabel={(count) => `${count} status`}
              onChange={(employeeStatusIds) =>
                filterParams.replaceParams(
                  { rankingStatuses: employeeStatusIds, rankingEmployees: [] },
                  { resetPage: true },
                )
              }
            />

            <MultiSelectFilter
              label="Colaborador"
              ariaLabel="Filtrar ranking por colaborador"
              options={employeeFilterOptions}
              values={filters.employeeIds}
              placeholder="Todos"
              searchable
              selectedLabel={(count) => `${count} colaboradores`}
              onChange={(employeeIds) => setFilter("employeeIds", employeeIds)}
            />

            <FormField label="Data inicial">
              <input
                type="date"
                className={fieldClassName}
                value={filters.startDate}
                onChange={(event) => setFilter("startDate", event.target.value)}
              />
            </FormField>

            <FormField label="Data final">
              <input
                type="date"
                className={fieldClassName}
                value={filters.endDate}
                onChange={(event) => setFilter("endDate", event.target.value)}
              />
            </FormField>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#f97316] px-4 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
              >
                <FileSearch className="h-4 w-4" />
                Gerar
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="grid h-10 w-10 place-items-center rounded-md border border-zinc-300 text-zinc-700 transition hover:border-[#f97316] hover:text-[#f97316]"
                title="Limpar filtros"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-w-xl">
            <MultiSelectFilter
              label="Tipos de ocorrência"
              ariaLabel="Filtrar ranking por tipos de ocorrência"
              options={occurrenceTypeFilterOptions}
              values={filters.occurrenceTypeIds}
              placeholder="Todos"
              searchable
              selectedLabel={(count) => `${count} tipos`}
              emptyText="Nenhum tipo cadastrado"
              onChange={(occurrenceTypeIds) => setFilter("occurrenceTypeIds", occurrenceTypeIds)}
            />
          </div>

          {validationError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {validationError}
            </div>
          ) : null}
        </form>
      </SectionCard>

      {actionError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <SectionCard
        title="Resultado do ranking"
        description={appliedFilters ? `Período analisado: ${formatRankingPeriod(appliedFilters)}` : undefined}
        actions={
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!rankingPdfReport || downloadingPdf}
            className="inline-flex items-center gap-2 rounded-md bg-[#111316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {downloadingPdf ? "Gerando PDF..." : "Gerar PDF"}
          </button>
        }
      >
        {appliedFilters ? (
          <div className="space-y-5">
            <div className="grid gap-4 border-y border-zinc-100 py-4 md:grid-cols-3">
              <div>
                <p className="text-2xl font-bold text-zinc-950">{filteredOccurrences.length}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Ocorrências filtradas
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-950">{rankingRows.length}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Colaboradores no ranking
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-950">
                  {rankingRows[0] ? formatOccurrenceCount(rankingRows[0].occurrenceCount) : "-"}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Maior volume individual
                </p>
              </div>
            </div>

            {topRankingRows.length > 0 ? (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[#f97316]" />
                  <h4 className="text-sm font-semibold text-zinc-950">Maiores volumes</h4>
                </div>
                <div className="space-y-3">
                  {topRankingRows.map((row) => (
                    <div key={row.employeeId} className="grid gap-2 md:grid-cols-[220px_1fr_92px] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {row.rank}º {row.employeeName}
                        </p>
                        <p className="text-xs text-zinc-500">{formatPercent(row.percentage)} do total filtrado</p>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-[#f97316]"
                          style={{ width: getBarWidth(row, maxOccurrences) }}
                        />
                      </div>
                      <p className="text-sm font-semibold text-zinc-950">{formatOccurrenceCount(row.occurrenceCount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <DataTable
              data={rankingRows}
              columns={columns}
              getRowKey={(item) => item.employeeId}
              emptyState={<EmptyState title="Nenhuma ocorrência encontrada" />}
            />
          </div>
        ) : (
          <EmptyState title="Nenhum ranking gerado" icon={Trophy} />
        )}
      </SectionCard>
    </div>
  );
}
