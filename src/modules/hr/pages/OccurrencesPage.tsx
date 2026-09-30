"use client";

import { Edit2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { DateFilter, MultiSelectFilter } from "@/components/filters";
import { useFilterSearchParams } from "@/hooks/useFilterSearchParams";
import { DailyOccurrenceReportPanel } from "@/modules/hr/components/DailyOccurrenceReportPanel";
import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { MonthlyOccurrenceReportPanel } from "@/modules/hr/components/MonthlyOccurrenceReportPanel";
import { OccurrenceRankingReportPanel } from "@/modules/hr/components/OccurrenceRankingReportPanel";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { Tabs } from "@/modules/hr/components/Tabs";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import { getCurrentUserAccess, hasMasterRole } from "@/modules/hr/services/auth.service";
import { listEmployees } from "@/modules/hr/services/employees.service";
import {
  createOccurrence,
  deleteOccurrence,
  listOccurrenceCategories,
  listOccurrences,
  listOccurrenceTypes,
  updateOccurrence,
} from "@/modules/hr/services/occurrences.service";
import type {
  Employee,
  EmployeeOccurrence,
  OccurrenceCategory,
  OccurrenceStatus,
  OccurrenceType,
  OccurrenceVisibility,
} from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { formatDateTime } from "@/modules/hr/utils/format";
import { occurrenceStatusLabels } from "@/modules/hr/utils/status";

interface OccurrencesPageData {
  occurrences: EmployeeOccurrence[];
  employees: Employee[];
  occurrenceTypes: OccurrenceType[];
  categories: OccurrenceCategory[];
  isMaster: boolean;
}

interface OccurrenceListFilters {
  employeeIds: string[];
  occurrenceTypeIds: string[];
  date: string;
}

const occurrenceTabIds = [
  "occurrences",
  "ranking-report",
  "daily-report",
  "monthly-report",
] as const;

type OccurrenceTabId = (typeof occurrenceTabIds)[number];

const occurrenceListFilterParamKeys = ["employees", "occurrenceTypes", "date", "page"];

async function loadOccurrencesPageData(): Promise<OccurrencesPageData> {
  const [occurrences, employees, occurrenceTypes, categories, currentUserAccess] = await Promise.all([
    listOccurrences(),
    listEmployees({}),
    listOccurrenceTypes(),
    listOccurrenceCategories(),
    getCurrentUserAccess(),
  ]);

  return { occurrences, employees, occurrenceTypes, categories, isMaster: hasMasterRole(currentUserAccess) };
}

function occurrenceMatchesDate(occurrence: EmployeeOccurrence, date: string) {
  if (!date) {
    return true;
  }

  const occurredDate = occurrence.occurred_at?.slice(0, 10);

  if (occurredDate === date) {
    return true;
  }

  const startDate = occurrence.start_date ?? occurredDate;
  const endDate = occurrence.end_date ?? startDate;

  return Boolean(startDate && endDate && date >= startDate && date <= endDate);
}

export function OccurrencesPage() {
  const filterParams = useFilterSearchParams();
  const activeTab = filterParams.getEnum<OccurrenceTabId>("tab", occurrenceTabIds, "occurrences");
  const occurrenceFilters: OccurrenceListFilters = {
    employeeIds: filterParams.getArray("employees"),
    occurrenceTypeIds: filterParams.getArray("occurrenceTypes"),
    date: filterParams.getDate("date"),
  };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingOccurrence, setEditingOccurrence] = useState<EmployeeOccurrence | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ visibility: "restricted", status: "open" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncResource(loadOccurrencesPageData);
  const employeeFilterOptions = useMemo(
    () =>
      data?.employees.map((employee) => ({
        value: employee.id,
        label: employee.full_name,
      })) ?? [],
    [data?.employees],
  );
  const occurrenceTypeFilterOptions = useMemo(
    () =>
      data?.occurrenceTypes.map((type) => ({
        value: type.id,
        label: type.name,
      })) ?? [],
    [data?.occurrenceTypes],
  );
  const filteredOccurrences = useMemo(
    () =>
      (data?.occurrences ?? []).filter((occurrence) => {
        if (
          occurrenceFilters.employeeIds.length > 0 &&
          !occurrenceFilters.employeeIds.includes(occurrence.employee_id)
        ) {
          return false;
        }

        if (
          occurrenceFilters.occurrenceTypeIds.length > 0 &&
          !occurrenceFilters.occurrenceTypeIds.includes(occurrence.occurrence_type_id)
        ) {
          return false;
        }

        return occurrenceMatchesDate(occurrence, occurrenceFilters.date);
      }),
    [data?.occurrences, occurrenceFilters.date, occurrenceFilters.employeeIds, occurrenceFilters.occurrenceTypeIds],
  );
  const hasOccurrenceFilters = Boolean(
    occurrenceFilters.employeeIds.length > 0 ||
      occurrenceFilters.occurrenceTypeIds.length > 0 ||
      occurrenceFilters.date,
  );

  const columns: Array<DataTableColumn<EmployeeOccurrence>> = [
      { key: "employee", header: "Colaborador", render: (item) => item.employee?.full_name ?? "-" },
      {
        key: "title",
        header: "Ocorrência",
        render: (item) => (
          <div>
            <p className="font-medium text-zinc-950">{item.title}</p>
            <p className="text-xs text-zinc-500">{item.occurrence_type?.name ?? "-"}</p>
          </div>
        ),
      },
      { key: "category", header: "Categoria", render: (item) => item.occurrence_category?.name ?? "-" },
      { key: "date", header: "Data", render: (item) => formatDateTime(item.occurred_at) },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={occurrenceStatusLabels[item.status]} status={item.status} />,
      },
      { key: "visibility", header: "Visibilidade", render: (item) => item.visibility },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openEdit(item)}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
              title="Editar ocorrência"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {data?.isMaster ? (
              <button
                type="button"
                onClick={() => removeOccurrence(item)}
                disabled={deletingId === item.id}
                className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                title="Remover ocorrência"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ),
      },
  ];

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setOccurrenceFilter<K extends keyof OccurrenceListFilters>(key: K, value: OccurrenceListFilters[K]) {
    const paramByFilterKey: Record<keyof OccurrenceListFilters, string> = {
      employeeIds: "employees",
      occurrenceTypeIds: "occurrenceTypes",
      date: "date",
    };

    filterParams.replaceParams({ [paramByFilterKey[key]]: value }, { resetPage: true });
  }

  function clearOccurrenceFilters() {
    filterParams.clearParams(occurrenceListFilterParamKeys);
  }

  function toDateTimeLocal(value?: string | null) {
    return value ? value.slice(0, 16) : "";
  }

  function openCreate() {
    setEditingOccurrence(null);
    setForm({ visibility: "restricted", status: "open" });
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(occurrence: EmployeeOccurrence) {
    setEditingOccurrence(occurrence);
    setForm({
      employee_id: occurrence.employee_id,
      occurrence_type_id: occurrence.occurrence_type_id,
      title: occurrence.title,
      description: occurrence.description,
      start_date: occurrence.start_date ?? occurrence.occurred_at.slice(0, 10),
      end_date: occurrence.end_date ?? "",
      total_days: occurrence.total_days ? String(occurrence.total_days) : "",
      justification_summary: occurrence.justification_summary ?? "",
      occurred_at: toDateTimeLocal(occurrence.occurred_at),
      visibility: occurrence.visibility ?? "restricted",
      status: occurrence.status ?? "open",
      internal_notes: occurrence.internal_notes ?? "",
      notes: occurrence.notes ?? "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function removeOccurrence(occurrence: EmployeeOccurrence) {
    const confirmed = window.confirm(
      `Remover a ocorrência "${occurrence.title}"? Ela deixará de aparecer nas listas e relatórios.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(occurrence.id);
    setActionError(null);

    try {
      await deleteOccurrence(occurrence.id);
      await reload();
    } catch (removeError) {
      setActionError(toUserFriendlyErrorMessage(removeError, "Não foi possível remover a ocorrência."));
    } finally {
      setDeletingId(null);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingOccurrence(null);
    setForm({ visibility: "restricted", status: "open" });
    setFormError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      if (!form.employee_id || !form.occurrence_type_id || !form.title || !form.description) {
        throw new Error("Colaborador, tipo, título e descrição são obrigatórios.");
      }

      const selectedType = data?.occurrenceTypes.find((type) => type.id === form.occurrence_type_id);
      const selectedEmployee = data?.employees.find((employee) => employee.id === form.employee_id);
      const startDate = form.start_date || form.occurred_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);

      const payload = {
        employee_id: form.employee_id,
        occurrence_type_id: form.occurrence_type_id,
        occurrence_category_id: selectedType?.occurrence_category_id,
        department_id: selectedEmployee?.department_id,
        title: form.title,
        description: form.description,
        occurred_at: form.occurred_at || `${startDate}T12:00:00`,
        start_date: startDate,
        end_date: form.end_date,
        total_days: form.total_days ? Number(form.total_days) : undefined,
        justification_summary: form.justification_summary,
        internal_notes: form.internal_notes,
        status: (form.status || "open") as OccurrenceStatus,
        visibility: (form.visibility || "restricted") as OccurrenceVisibility,
        notes: form.notes,
      };

      if (editingOccurrence) {
        await updateOccurrence(editingOccurrence.id, payload);
      } else {
        await createOccurrence(payload);
      }

      closeDrawer();
      await reload();
    } catch (submitError) {
      setFormError(toUserFriendlyErrorMessage(submitError, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Histórico interno"
        title="Ocorrências"
        description="Registro controlado de advertências, elogios, feedbacks, faltas, atestados e movimentações internas."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
          >
            <Plus className="h-4 w-4" />
            Nova ocorrência
          </button>
        }
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {actionError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {data ? (
        <Tabs
          activeTab={activeTab}
          onTabChange={(tabId) =>
            filterParams.replaceParams({
              tab: tabId === "occurrences" ? null : tabId,
            })
          }
          tabs={[
            {
              id: "occurrences",
              label: "Lista de ocorrências",
              content: (
                <SectionCard
                  title="Ocorrências registradas"
                  description={
                    hasOccurrenceFilters
                      ? `${filteredOccurrences.length} de ${data.occurrences.length} registro(s)`
                      : `${data.occurrences.length} registro(s)`
                  }
                >
                  <div className="mb-4 grid gap-4 md:grid-cols-[1.2fr_1fr_180px_auto] md:items-end">
                    <MultiSelectFilter
                      label="Colaborador"
                      ariaLabel="Filtrar ocorrências por colaborador"
                      options={employeeFilterOptions}
                      values={occurrenceFilters.employeeIds}
                      placeholder="Todos"
                      searchable
                      selectedLabel={(count) => `${count} colaboradores`}
                      onChange={(employeeIds) => setOccurrenceFilter("employeeIds", employeeIds)}
                    />

                    <MultiSelectFilter
                      label="Tipo de ocorrência"
                      ariaLabel="Filtrar ocorrências por tipo"
                      options={occurrenceTypeFilterOptions}
                      values={occurrenceFilters.occurrenceTypeIds}
                      placeholder="Todos"
                      searchable
                      selectedLabel={(count) => `${count} tipos`}
                      onChange={(occurrenceTypeIds) =>
                        setOccurrenceFilter("occurrenceTypeIds", occurrenceTypeIds)
                      }
                    />

                    <DateFilter
                      label="Data"
                      value={occurrenceFilters.date}
                      onChange={(date) => setOccurrenceFilter("date", date)}
                    />

                    <button
                      type="button"
                      onClick={clearOccurrenceFilters}
                      disabled={!hasOccurrenceFilters}
                      className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Limpar
                    </button>
                  </div>

                  <DataTable
                    data={filteredOccurrences}
                    columns={columns}
                    getRowKey={(item) => item.id}
                    emptyState={
                      <EmptyState
                        title={hasOccurrenceFilters ? "Nenhuma ocorrência encontrada" : "Nenhuma ocorrência registrada"}
                        description={
                          hasOccurrenceFilters
                            ? "Ajuste os filtros para visualizar outros registros."
                            : undefined
                        }
                      />
                    }
                  />
                </SectionCard>
              ),
            },
            {
              id: "ranking-report",
              label: "Ranking de ocorrências",
              content: (
                <OccurrenceRankingReportPanel
                  occurrences={data.occurrences}
                  employees={data.employees}
                  occurrenceTypes={data.occurrenceTypes}
                />
              ),
            },
            {
              id: "daily-report",
              label: "Relatório diário",
              content: <DailyOccurrenceReportPanel />,
            },
            {
              id: "monthly-report",
              label: "Relatório mensal",
              content: <MonthlyOccurrenceReportPanel />,
            },
          ]}
        />
      ) : null}

      <DrawerForm
        open={drawerOpen}
        title={editingOccurrence ? "Editar ocorrência" : "Nova ocorrência"}
        description={
          editingOccurrence
            ? "Atualize os dados lançados incorretamente."
            : "Tipos e categorias são configuráveis pelo Master."
        }
        onClose={closeDrawer}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <FormField label="Colaborador" required>
            <select
              className={fieldClassName}
              value={form.employee_id ?? ""}
              onChange={(event) => setField("employee_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {data?.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Tipo de ocorrência" required>
            <select
              className={fieldClassName}
              value={form.occurrence_type_id ?? ""}
              onChange={(event) => setField("occurrence_type_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {data?.occurrenceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Título" required>
            <input
              className={fieldClassName}
              value={form.title ?? ""}
              onChange={(event) => setField("title", event.target.value)}
            />
          </FormField>

          <FormField label="Descrição" required>
            <textarea
              className={`${fieldClassName} min-h-32`}
              value={form.description ?? ""}
              onChange={(event) => setField("description", event.target.value)}
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Data inicial">
              <input
                type="date"
                className={fieldClassName}
                value={form.start_date ?? ""}
                onChange={(event) => setField("start_date", event.target.value)}
              />
            </FormField>
            <FormField label="Data final">
              <input
                type="date"
                className={fieldClassName}
                value={form.end_date ?? ""}
                onChange={(event) => setField("end_date", event.target.value)}
              />
            </FormField>
            <FormField label="Quantidade de dias">
              <input
                type="number"
                min="1"
                className={fieldClassName}
                value={form.total_days ?? ""}
                onChange={(event) => setField("total_days", event.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Justificativa resumida">
            <textarea
              className={`${fieldClassName} min-h-20`}
              value={form.justification_summary ?? ""}
              onChange={(event) => setField("justification_summary", event.target.value)}
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Data da ocorrência">
              <input
                type="datetime-local"
                className={fieldClassName}
                value={form.occurred_at ?? ""}
                onChange={(event) => setField("occurred_at", event.target.value)}
              />
            </FormField>
            <FormField label="Visibilidade">
              <select
                className={fieldClassName}
                value={form.visibility ?? "restricted"}
                onChange={(event) => setField("visibility", event.target.value)}
              >
                <option value="restricted">Restrita</option>
                <option value="manager">Gestor</option>
                <option value="employee">Colaborador</option>
                <option value="public_internal">Interna pública</option>
              </select>
            </FormField>
          </div>

          <FormField label="Status">
            <select
              className={fieldClassName}
              value={form.status ?? "open"}
              onChange={(event) => setField("status", event.target.value)}
            >
              <option value="open">Aberta</option>
              <option value="in_review">Em análise</option>
              <option value="approved">Aprovada</option>
              <option value="rejected">Recusada</option>
              <option value="closed">Fechada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </FormField>

          <FormField label="Observações internas">
            <textarea
              className={`${fieldClassName} min-h-20`}
              value={form.internal_notes ?? ""}
              onChange={(event) => setField("internal_notes", event.target.value)}
            />
          </FormField>

          <FormField label="Observações gerais">
            <textarea
              className={`${fieldClassName} min-h-24`}
              value={form.notes ?? ""}
              onChange={(event) => setField("notes", event.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-5">
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingOccurrence ? "Salvar alterações" : "Salvar ocorrência"}
            </button>
          </div>
        </form>
      </DrawerForm>
    </div>
  );
}
