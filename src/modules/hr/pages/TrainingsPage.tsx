"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import { listEmployees } from "@/modules/hr/services/employees.service";
import {
  createEmployeeTraining,
  createTraining,
  listEmployeeTrainings,
  listTrainings,
} from "@/modules/hr/services/trainings.service";
import type { Employee, EmployeeTraining, Training } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { formatDate } from "@/modules/hr/utils/format";
import { trainingStatusLabels } from "@/modules/hr/utils/status";

interface TrainingsPageData {
  trainings: Training[];
  employeeTrainings: EmployeeTraining[];
  employees: Employee[];
}

async function loadTrainingsPageData(): Promise<TrainingsPageData> {
  const [trainings, employeeTrainings, employees] = await Promise.all([
    listTrainings(true),
    listEmployeeTrainings(),
    listEmployees({}),
  ]);

  return { trainings, employeeTrainings, employees };
}

type DrawerMode = "training" | "employee_training" | null;

export function TrainingsPage() {
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncResource(loadTrainingsPageData);

  const trainingColumns = useMemo<Array<DataTableColumn<Training>>>(
    () => [
      { key: "name", header: "Treinamento", render: (item) => item.name },
      { key: "validity", header: "Validade", render: (item) => item.validity_months ? `${item.validity_months} meses` : "Sem validade" },
      { key: "required", header: "Obrigatório", render: (item) => item.is_required ? "Sim" : "Não" },
      { key: "active", header: "Status", render: (item) => <StatusBadge label={item.is_active ? "Ativo" : "Inativo"} status={item.is_active ? "ativo" : "inativo"} /> },
    ],
    [],
  );

  const employeeTrainingColumns = useMemo<Array<DataTableColumn<EmployeeTraining>>>(
    () => [
      { key: "employee", header: "Colaborador", render: (item) => item.employee?.full_name ?? "-" },
      { key: "training", header: "Treinamento", render: (item) => item.training?.name ?? "-" },
      { key: "completion", header: "Conclusão", render: (item) => formatDate(item.completion_date) },
      { key: "expiration", header: "Validade", render: (item) => formatDate(item.expiration_date) },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={trainingStatusLabels[item.status]} status={item.status} />,
      },
    ],
    [],
  );

  function setField(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      if (drawerMode === "training") {
        await createTraining({
          name: String(form.name ?? ""),
          description: String(form.description ?? ""),
          validity_months: form.validity_months ? Number(form.validity_months) : undefined,
          is_required: Boolean(form.is_required),
        });
      }

      if (drawerMode === "employee_training") {
        await createEmployeeTraining({
          employee_id: String(form.employee_id ?? ""),
          training_id: String(form.training_id ?? ""),
          completion_date: String(form.completion_date ?? ""),
          expiration_date: form.expiration_date ? String(form.expiration_date) : undefined,
          status: "completed",
          notes: String(form.notes ?? ""),
        });
      }

      setDrawerMode(null);
      setForm({});
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
        eyebrow="Capacitação"
        title="Treinamentos"
        description="Controle de treinamentos, certificações, obrigatoriedade, validade e vencimentos."
        actions={
          <>
            <button
              type="button"
              onClick={() => setDrawerMode("training")}
              className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              <Plus className="h-4 w-4" />
              Novo treinamento
            </button>
            <button
              type="button"
              onClick={() => setDrawerMode("employee_training")}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:border-[#f97316] hover:text-[#f97316]"
            >
              <Plus className="h-4 w-4" />
              Vincular colaborador
            </button>
          </>
        }
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <div className="space-y-6">
          <SectionCard title="Catalogo de treinamentos">
            <DataTable
              data={data.trainings}
              columns={trainingColumns}
              getRowKey={(item) => item.id}
              emptyState={<EmptyState title="Nenhum treinamento cadastrado" />}
            />
          </SectionCard>

          <SectionCard title="Treinamentos por colaborador">
            <DataTable
              data={data.employeeTrainings}
              columns={employeeTrainingColumns}
              getRowKey={(item) => item.id}
              emptyState={<EmptyState title="Nenhum treinamento vinculado" />}
            />
          </SectionCard>
        </div>
      ) : null}

      <DrawerForm
        open={drawerMode !== null}
        title={drawerMode === "training" ? "Novo treinamento" : "Vincular treinamento"}
        onClose={() => setDrawerMode(null)}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          {drawerMode === "training" ? (
            <>
              <FormField label="Nome" required>
                <input
                  className={fieldClassName}
                  value={String(form.name ?? "")}
                  onChange={(event) => setField("name", event.target.value)}
                />
              </FormField>
              <FormField label="Descrição">
                <textarea
                  className={`${fieldClassName} min-h-24`}
                  value={String(form.description ?? "")}
                  onChange={(event) => setField("description", event.target.value)}
                />
              </FormField>
              <FormField label="Validade em meses">
                <input
                  type="number"
                  min="1"
                  className={fieldClassName}
                  value={String(form.validity_months ?? "")}
                  onChange={(event) => setField("validity_months", event.target.value)}
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_required)}
                  onChange={(event) => setField("is_required", event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                />
                Obrigatório
              </label>
            </>
          ) : (
            <>
              <FormField label="Colaborador" required>
                <select
                  className={fieldClassName}
                  value={String(form.employee_id ?? "")}
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
              <FormField label="Treinamento" required>
                <select
                  className={fieldClassName}
                  value={String(form.training_id ?? "")}
                  onChange={(event) => setField("training_id", event.target.value)}
                >
                  <option value="">Selecione</option>
                  {data?.trainings
                    .filter((training) => training.is_active)
                    .map((training) => (
                      <option key={training.id} value={training.id}>
                        {training.name}
                      </option>
                    ))}
                </select>
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Data de conclusao" required>
                  <input
                    type="date"
                    className={fieldClassName}
                    value={String(form.completion_date ?? "")}
                    onChange={(event) => setField("completion_date", event.target.value)}
                  />
                </FormField>
                <FormField label="Data de validade">
                  <input
                    type="date"
                    className={fieldClassName}
                    value={String(form.expiration_date ?? "")}
                    onChange={(event) => setField("expiration_date", event.target.value)}
                  />
                </FormField>
              </div>
              <FormField label="Observacoes">
                <textarea
                  className={`${fieldClassName} min-h-24`}
                  value={String(form.notes ?? "")}
                  onChange={(event) => setField("notes", event.target.value)}
                />
              </FormField>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-5">
            <button
              type="button"
              onClick={() => setDrawerMode(null)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </DrawerForm>
    </div>
  );
}
