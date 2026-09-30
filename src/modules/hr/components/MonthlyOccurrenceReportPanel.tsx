"use client";

import { Download, FileSearch, FileText } from "lucide-react";
import { useMemo, useState } from "react";

import { CompetenceFilter, MultiSelectFilter } from "@/components/filters";
import { useFilterSearchParams } from "@/hooks/useFilterSearchParams";
import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import {
  downloadMonthlyOccurrenceReportPdf,
  generateMonthlyOccurrenceReport,
  getDefaultCompetence,
  getMonthlyOccurrenceReportPeriodLabel,
  type MonthlyOccurrenceDepartmentSummary,
  type MonthlyOccurrenceReport,
} from "@/modules/hr/services/monthly-occurrence-report.service";
import { listEmployees } from "@/modules/hr/services/employees.service";
import { listOccurrenceTypes } from "@/modules/hr/services/occurrences.service";
import { listSettingItems } from "@/modules/hr/services/settings.service";
import type { Department, Employee, OccurrenceType } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { isPayrollRelevantOccurrenceType } from "@/modules/hr/utils/occurrences";

interface MonthlyOccurrenceReportPanelData {
  departments: Department[];
  employees: Employee[];
  occurrenceTypes: OccurrenceType[];
}

async function loadMonthlyOccurrenceReportPanelData(): Promise<MonthlyOccurrenceReportPanelData> {
  const [departments, employees, occurrenceTypes] = await Promise.all([
    listSettingItems("departments"),
    listEmployees(),
    listOccurrenceTypes(),
  ]);

  return {
    departments: departments as Department[],
    employees,
    occurrenceTypes,
  };
}

export function MonthlyOccurrenceReportPanel() {
  const filterParams = useFilterSearchParams();
  const competence = filterParams.getMonth("monthlyCompetence", getDefaultCompetence());
  const departmentIds = filterParams.getArray("monthlyDepartments");
  const employeeIds = filterParams.getArray("monthlyEmployees");
  const occurrenceTypeIds = filterParams.getArray("monthlyOccurrenceTypes");
  const onlyPayrollRelevant = filterParams.getBoolean("monthlyPayrollRelevant", true) ?? true;
  const [report, setReport] = useState<MonthlyOccurrenceReport | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { data, loading, error } = useAsyncResource(loadMonthlyOccurrenceReportPanelData);

  const monthlyTypes = useMemo(
    () =>
      (onlyPayrollRelevant
        ? data?.occurrenceTypes.filter(isPayrollRelevantOccurrenceType)
        : data?.occurrenceTypes) ?? [],
    [data?.occurrenceTypes, onlyPayrollRelevant],
  );

  const employeeOptions = useMemo(
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
  const employeeFilterOptions = useMemo(
    () =>
      employeeOptions.map((employee) => ({
        value: employee.id,
        label: employee.full_name,
      })),
    [employeeOptions],
  );
  const occurrenceTypeOptions = useMemo(
    () =>
      monthlyTypes.map((type) => ({
        value: type.id,
        label: type.name,
      })),
    [monthlyTypes],
  );

  const departmentColumns = useMemo<Array<DataTableColumn<MonthlyOccurrenceDepartmentSummary>>>(
    () => [
      { key: "department", header: "Departamento", render: (item) => item.departmentName },
      { key: "employees", header: "Colaboradores", render: (item) => item.employeeCount },
      { key: "occurrences", header: "Ocorrências", render: (item) => item.occurrenceCount },
      { key: "days", header: "Dias impactados", render: (item) => item.impactDays },
      { key: "absences", header: "Faltas/Ausências", render: (item) => item.absenceCount },
      { key: "delays", header: "Atrasos", render: (item) => item.delayCount },
      { key: "certificates", header: "Atestados", render: (item) => item.medicalCertificateCount },
    ],
    [],
  );

  function resetMessages() {
    setActionError(null);
    setSuccessMessage(null);
  }

  async function buildReport() {
    return generateMonthlyOccurrenceReport(competence, {
      departmentIds,
      employeeIds,
      occurrenceTypeIds,
      onlyPayrollRelevant,
    });
  }

  async function handlePreview() {
    resetMessages();
    setGeneratingPreview(true);

    try {
      const nextReport = await buildReport();
      setReport(nextReport);
      setSuccessMessage("Prévia mensal gerada com sucesso.");
    } catch (previewError) {
      setActionError(toUserFriendlyErrorMessage(previewError, "Não foi possível gerar a prévia mensal."));
    } finally {
      setGeneratingPreview(false);
    }
  }

  async function handleDownloadPdf() {
    resetMessages();
    setDownloadingPdf(true);

    try {
      const currentReport = report ?? (await buildReport());
      setReport(currentReport);
      await downloadMonthlyOccurrenceReportPdf(currentReport);
      setSuccessMessage("PDF mensal gerado com sucesso.");
    } catch (pdfError) {
      setActionError(toUserFriendlyErrorMessage(pdfError, "Não foi possível gerar o PDF."));
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="space-y-5">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      <SectionCard
        title="Relatório mensal de ocorrências"
        description="Consolidação por competência para apoiar a conferência da folha de pagamento."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[0.8fr_1fr_1fr_1fr_auto]">
          <CompetenceFilter
            label="Competência"
            value={competence}
            onChange={(nextCompetence) => filterParams.replaceParams({ monthlyCompetence: nextCompetence })}
          />

          <MultiSelectFilter
            label="Departamento"
            ariaLabel="Filtrar relatório mensal por departamento"
            options={departmentOptions}
            values={departmentIds}
            placeholder="Todos"
            selectedLabel={(count) => `${count} departamentos`}
            onChange={(nextDepartmentIds) => {
              filterParams.replaceParams({
                monthlyDepartments: nextDepartmentIds,
                monthlyEmployees: [],
              });
            }}
          />

          <MultiSelectFilter
            label="Colaborador"
            ariaLabel="Filtrar relatório mensal por colaborador"
            options={employeeFilterOptions}
            values={employeeIds}
            placeholder="Todos"
            searchable
            selectedLabel={(count) => `${count} colaboradores`}
            onChange={(nextEmployeeIds) => filterParams.replaceParams({ monthlyEmployees: nextEmployeeIds })}
          />

          <MultiSelectFilter
            label="Tipo de ocorrência"
            ariaLabel="Filtrar relatório mensal por tipo de ocorrência"
            options={occurrenceTypeOptions}
            values={occurrenceTypeIds}
            placeholder="Todos"
            searchable
            selectedLabel={(count) => `${count} tipos`}
            onChange={(nextOccurrenceTypeIds) =>
              filterParams.replaceParams({ monthlyOccurrenceTypes: nextOccurrenceTypeIds })
            }
          />

          <div className="flex items-end">
            <button
              type="button"
              onClick={handlePreview}
              disabled={generatingPreview || loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-60"
            >
              <FileSearch className="h-4 w-4" />
              {generatingPreview ? "Gerando..." : "Gerar prévia"}
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={onlyPayrollRelevant}
            onChange={(event) => {
              filterParams.replaceParams(
                {
                  monthlyPayrollRelevant: event.target.checked,
                  monthlyOccurrenceTypes: [],
                },
                { defaults: { monthlyPayrollRelevant: true } },
              );
            }}
            className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
          />
          Considerar apenas ocorrências com impacto de folha ou ausência
        </label>
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
        title="Prévia do fechamento"
        description={report ? `Período: ${getMonthlyOccurrenceReportPeriodLabel(report)}` : "Gere uma prévia para revisar os dados antes do PDF."}
        actions={
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || loading}
            className="inline-flex items-center gap-2 rounded-md bg-[#111316] px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {downloadingPdf ? "Gerando PDF..." : "Gerar PDF"}
          </button>
        }
      >
        {report ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-6">
              <Metric label="Ocorrências" value={report.summary.occurrenceCount} />
              <Metric label="Colaboradores" value={report.summary.employeeCount} />
              <Metric label="Departamentos" value={report.summary.departmentCount} />
              <Metric label="Dias impactados" value={report.summary.impactDays} />
              <Metric label="Atrasos" value={report.summary.delayCount} />
              <Metric label="Atestados" value={report.summary.medicalCertificateCount} />
            </div>

            <DataTable
              data={report.departmentSummaries}
              columns={departmentColumns}
              getRowKey={(item) => item.departmentName}
              emptyState={<EmptyState title="Nenhuma ocorrência na competência" />}
            />

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <FileText className="h-5 w-5 text-[#f97316]" />
                <p className="text-sm font-semibold text-zinc-950">
                  {report.rows.length} ocorrência(s) serão incluídas no PDF.
                </p>
                <StatusBadge label={report.filters.onlyPayrollRelevant ? "Escopo folha" : "Todas"} status="info" />
                <StatusBadge label={report.filters.employeeName} status="info" />
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                O arquivo inclui resumo executivo, totais por departamento e detalhamento por colaborador.
              </p>
            </div>
          </div>
        ) : (
          <EmptyState title="Nenhuma prévia gerada" description="Selecione a competência e gere a prévia mensal." />
        )}
      </SectionCard>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-2xl font-bold text-[#f97316]">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</p>
    </div>
  );
}
