"use client";

import { Check, Clipboard, FileText, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { DateFilter, MultiSelectFilter } from "@/components/filters";
import { useFilterSearchParams } from "@/hooks/useFilterSearchParams";
import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { fieldClassName } from "@/modules/hr/components/FormField";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import {
  generateDailyOccurrenceReport,
  listDailyOccurrenceReports,
  markOccurrenceReportAsCopied,
  saveGeneratedOccurrenceReport,
  updateGeneratedOccurrenceReportText,
} from "@/modules/hr/services/daily-occurrence-report.service";
import { listOccurrenceTypes } from "@/modules/hr/services/occurrences.service";
import { listSettingItems } from "@/modules/hr/services/settings.service";
import type {
  DailyOccurrenceReportWithAuthor,
  Department,
  ID,
  OccurrenceType,
} from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { formatDate, formatDateTime } from "@/modules/hr/utils/format";
import { isDailyReportOccurrenceType } from "@/modules/hr/utils/occurrences";

interface DailyOccurrenceReportPanelData {
  departments: Department[];
  occurrenceTypes: OccurrenceType[];
  history: DailyOccurrenceReportWithAuthor[];
}

function localTodayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

async function loadDailyOccurrenceReportPanelData(): Promise<DailyOccurrenceReportPanelData> {
  const [departments, occurrenceTypes, history] = await Promise.all([
    listSettingItems("departments"),
    listOccurrenceTypes(),
    listDailyOccurrenceReports({ limit: 10 }),
  ]);

  return {
    departments: departments as Department[],
    occurrenceTypes,
    history,
  };
}

export function DailyOccurrenceReportPanel() {
  const filterParams = useFilterSearchParams();
  const reportDate = filterParams.getDate("dailyDate", localTodayIsoDate());
  const departmentIds = filterParams.getArray("dailyDepartments");
  const occurrenceTypeIds = filterParams.getArray("dailyOccurrenceTypes");
  const [editedText, setEditedText] = useState("");
  const [activeReportId, setActiveReportId] = useState<ID | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncResource(loadDailyOccurrenceReportPanelData);

  const reportTypes = useMemo(
    () => data?.occurrenceTypes.filter(isDailyReportOccurrenceType) ?? [],
    [data?.occurrenceTypes],
  );
  const departmentOptions = useMemo(
    () =>
      data?.departments.map((department) => ({
        value: department.id,
        label: department.name,
      })) ?? [],
    [data?.departments],
  );
  const reportTypeOptions = useMemo(
    () =>
      reportTypes.map((type) => ({
        value: type.id,
        label: type.name,
      })),
    [reportTypes],
  );

  const historyColumns: Array<DataTableColumn<DailyOccurrenceReportWithAuthor>> = [
      { key: "report_date", header: "Data", render: (item) => formatDate(item.report_date) },
      {
        key: "generated_by",
        header: "Gerado por",
        render: (item) => item.generated_by_profile?.full_name ?? item.generated_by_profile?.email ?? "-",
      },
      { key: "created_at", header: "Geração", render: (item) => formatDateTime(item.created_at) },
      {
        key: "copied_at",
        header: "Cópia",
        render: (item) => (
          <StatusBadge
            label={item.copied_at ? "Copiado" : "Pendente"}
            status={item.copied_at ? "approved" : "pending"}
          />
        ),
      },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <button
            type="button"
            onClick={() => loadReportFromHistory(item)}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-[#f97316] hover:text-[#f97316]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Carregar
          </button>
        ),
      },
    ];

  function resetMessages() {
    setSuccessMessage(null);
    setWarningMessage(null);
    setActionError(null);
  }

  async function handleGenerate() {
    resetMessages();
    setGenerating(true);

    try {
      const report = await generateDailyOccurrenceReport(reportDate, {
        departmentIds,
        occurrenceTypeIds,
      });

      setEditedText(report.generatedText);
      setActiveReportId(null);

      try {
        const savedReport = await saveGeneratedOccurrenceReport({
          reportDate,
          generatedText: report.generatedText,
          editedText: report.generatedText,
          items: report.items,
        });

        setActiveReportId(savedReport.id);
        setSuccessMessage("Relatório gerado e salvo no histórico.");
        await reload();
      } catch (historyError) {
        setWarningMessage(
          `Relatório gerado, mas o histórico não foi salvo: ${toUserFriendlyErrorMessage(
            historyError,
            "tente salvar novamente em instantes.",
          )}`,
        );
      }
    } catch (generateError) {
      setActionError(toUserFriendlyErrorMessage(generateError, "Não foi possível gerar o relatório diário."));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    resetMessages();

    if (!editedText.trim()) {
      setActionError("Gere ou carregue um relatório antes de copiar.");
      return;
    }

    setCopying(true);

    try {
      if (activeReportId) {
        await updateGeneratedOccurrenceReportText(activeReportId, editedText);
      }

      await navigator.clipboard.writeText(editedText.trimEnd());

      if (activeReportId) {
        await markOccurrenceReportAsCopied(activeReportId);
        await reload();
      }

      setSuccessMessage("Relatório copiado com sucesso.");
    } catch (copyError) {
      setActionError(toUserFriendlyErrorMessage(copyError, "Não foi possível copiar o relatório."));
    } finally {
      setCopying(false);
    }
  }

  function loadReportFromHistory(report: DailyOccurrenceReportWithAuthor) {
    resetMessages();
    filterParams.replaceParams({ dailyDate: report.report_date });
    setEditedText(report.edited_text ?? report.generated_text);
    setActiveReportId(report.id);
    setSuccessMessage("Relatório carregado do histórico.");
  }

  return (
    <div className="space-y-5">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      <SectionCard title="Relatório diário" description="Texto operacional baseado nas ocorrências cadastradas.">
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <DateFilter
            label="Data"
            value={reportDate}
            onChange={(nextReportDate) => filterParams.replaceParams({ dailyDate: nextReportDate })}
          />

          <MultiSelectFilter
            label="Departamento"
            ariaLabel="Filtrar relatório diário por departamento"
            options={departmentOptions}
            values={departmentIds}
            placeholder="Todos"
            selectedLabel={(count) => `${count} departamentos`}
            onChange={(nextDepartmentIds) =>
              filterParams.replaceParams({ dailyDepartments: nextDepartmentIds })
            }
          />

          <MultiSelectFilter
            label="Tipo de ocorrência"
            ariaLabel="Filtrar relatório diário por tipo de ocorrência"
            options={reportTypeOptions}
            values={occurrenceTypeIds}
            placeholder="Todos do relatório"
            searchable
            selectedLabel={(count) => `${count} tipos`}
            onChange={(nextOccurrenceTypeIds) =>
              filterParams.replaceParams({ dailyOccurrenceTypes: nextOccurrenceTypeIds })
            }
          />

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#f97316] px-4 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              {generating ? "Gerando..." : "Gerar relatório"}
            </button>
          </div>
        </div>

        {reportTypes.length === 0 && !loading ? (
          <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            Nenhum tipo de ocorrência está marcado para entrar no relatório diário.
          </div>
        ) : null}
      </SectionCard>

      {actionError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      ) : null}
      {warningMessage ? (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          {warningMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Texto editável"
          description="Revise o conteúdo antes de copiar para envio manual."
          actions={
            <button
              type="button"
              onClick={handleCopy}
              disabled={copying || !editedText.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-[#111316] px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {successMessage?.includes("copiado") ? (
                <Check className="h-4 w-4" />
              ) : (
                <Clipboard className="h-4 w-4" />
              )}
              {copying ? "Copiando..." : "Copiar relatório"}
            </button>
          }
        >
          <textarea
            className={`${fieldClassName} min-h-80 font-mono leading-6`}
            value={editedText}
            onChange={(event) => setEditedText(event.target.value)}
            placeholder="Gere um relatório para editar o texto aqui."
          />
        </SectionCard>

        <SectionCard title="Pré-visualização" description="Espelho do texto que será copiado.">
          {editedText.trim() ? (
            <pre className="min-h-80 whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-4 font-sans text-sm leading-6 text-zinc-800">
              {editedText}
            </pre>
          ) : (
            <EmptyState title="Nenhum relatório gerado" description="Selecione os filtros e gere o relatório." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Histórico de relatórios" description="Últimos relatórios gerados para consulta rápida.">
        <DataTable
          data={data?.history ?? []}
          columns={historyColumns}
          getRowKey={(item) => item.id}
          emptyState={<EmptyState title="Nenhum relatório no histórico" />}
        />
      </SectionCard>
    </div>
  );
}
