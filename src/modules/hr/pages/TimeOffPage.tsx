"use client";

import { Check, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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
  createLeave,
  createVacation,
  listLeaveTypes,
  listLeaves,
  listVacations,
  updateLeaveStatus,
  updateVacationStatus,
} from "@/modules/hr/services/vacations.service";
import type { Employee, EmployeeLeave, LeaveType, Vacation } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { formatDate } from "@/modules/hr/utils/format";
import { workflowStatusLabels } from "@/modules/hr/utils/status";

interface TimeOffPageData {
  employees: Employee[];
  vacations: Vacation[];
  leaves: EmployeeLeave[];
  leaveTypes: LeaveType[];
}

async function loadTimeOffPageData(): Promise<TimeOffPageData> {
  const [employees, vacations, leaves, leaveTypes] = await Promise.all([
    listEmployees({}),
    listVacations(),
    listLeaves(),
    listLeaveTypes(),
  ]);

  return {
    employees,
    vacations,
    leaves,
    leaveTypes: leaveTypes as LeaveType[],
  };
}

type DrawerMode = "vacation" | "leave" | null;

export function TimeOffPage() {
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncResource(loadTimeOffPageData);

  const updateVacationWorkflow = useCallback(
    async (vacationId: string, status: Parameters<typeof updateVacationStatus>[1], fallback: string) => {
      setActionError(null);

      try {
        await updateVacationStatus(vacationId, status);
        await reload();
      } catch (statusError) {
        setActionError(toUserFriendlyErrorMessage(statusError, fallback));
      }
    },
    [reload],
  );

  const updateLeaveWorkflow = useCallback(
    async (leaveId: string, status: Parameters<typeof updateLeaveStatus>[1], fallback: string) => {
      setActionError(null);

      try {
        await updateLeaveStatus(leaveId, status);
        await reload();
      } catch (statusError) {
        setActionError(toUserFriendlyErrorMessage(statusError, fallback));
      }
    },
    [reload],
  );

  const vacationColumns = useMemo<Array<DataTableColumn<Vacation>>>(
    () => [
      {
        key: "employee",
        header: "Colaborador",
        render: (item) => item.employee?.full_name ?? "-",
      },
      {
        key: "accrual",
        header: "Período aquisitivo",
        render: (item) => `${formatDate(item.accrual_period_start)} até ${formatDate(item.accrual_period_end)}`,
      },
      {
        key: "vacation",
        header: "Férias",
        render: (item) => `${formatDate(item.vacation_start)} até ${formatDate(item.vacation_end)}`,
      },
      { key: "days", header: "Dias", render: (item) => item.days_count },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={workflowStatusLabels[item.status]} status={item.status} />,
      },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateVacationWorkflow(item.id, "approved", "Não foi possível aprovar as férias.")}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-emerald-200 hover:text-emerald-700"
              title="Aprovar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => updateVacationWorkflow(item.id, "rejected", "Não foi possível recusar as férias.")}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-red-200 hover:text-red-600"
              title="Recusar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [updateVacationWorkflow],
  );

  const leaveColumns = useMemo<Array<DataTableColumn<EmployeeLeave>>>(
    () => [
      { key: "employee", header: "Colaborador", render: (item) => item.employee?.full_name ?? "-" },
      { key: "type", header: "Tipo", render: (item) => item.leave_type?.name ?? "-" },
      {
        key: "period",
        header: "Período",
        render: (item) => `${formatDate(item.start_date)} ${item.end_date ? `até ${formatDate(item.end_date)}` : ""}`,
      },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={workflowStatusLabels[item.status]} status={item.status} />,
      },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateLeaveWorkflow(item.id, "approved", "Não foi possível aprovar o afastamento.")}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-emerald-200 hover:text-emerald-700"
              title="Aprovar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => updateLeaveWorkflow(item.id, "rejected", "Não foi possível recusar o afastamento.")}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-red-200 hover:text-red-600"
              title="Recusar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [updateLeaveWorkflow],
  );

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      if (drawerMode === "vacation") {
        await createVacation({
          employee_id: form.employee_id,
          accrual_period_start: form.accrual_period_start,
          accrual_period_end: form.accrual_period_end,
          vacation_start: form.vacation_start,
          vacation_end: form.vacation_end,
          days_count: Number(form.days_count || 0),
          notes: form.notes,
        });
      }

      if (drawerMode === "leave") {
        await createLeave({
          employee_id: form.employee_id,
          leave_type_id: form.leave_type_id,
          start_date: form.start_date,
          end_date: form.end_date || undefined,
          notes: form.notes,
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
        eyebrow="Jornada"
        title="Férias e afastamentos"
        description="Controle de períodos aquisitivos, férias, afastamentos, status e documentos relacionados."
        actions={
          <>
            <button
              type="button"
              onClick={() => setDrawerMode("vacation")}
              className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              <Plus className="h-4 w-4" />
              Novas férias
            </button>
            <button
              type="button"
              onClick={() => setDrawerMode("leave")}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:border-[#f97316] hover:text-[#f97316]"
            >
              <Plus className="h-4 w-4" />
              Novo afastamento
            </button>
          </>
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
        <div className="space-y-6">
          <SectionCard title="Férias">
            <DataTable
              data={data.vacations}
              columns={vacationColumns}
              getRowKey={(item) => item.id}
              emptyState={<EmptyState title="Nenhum período de férias registrado" />}
            />
          </SectionCard>

          <SectionCard title="Afastamentos">
            <DataTable
              data={data.leaves}
              columns={leaveColumns}
              getRowKey={(item) => item.id}
              emptyState={<EmptyState title="Nenhum afastamento registrado" />}
            />
          </SectionCard>
        </div>
      ) : null}

      <DrawerForm
        open={drawerMode !== null}
        title={drawerMode === "vacation" ? "Novas férias" : "Novo afastamento"}
        onClose={() => setDrawerMode(null)}
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

          {drawerMode === "vacation" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Período aquisitivo inicial" required>
                  <input type="date" className={fieldClassName} value={form.accrual_period_start ?? ""} onChange={(event) => setField("accrual_period_start", event.target.value)} />
                </FormField>
                <FormField label="Período aquisitivo final" required>
                  <input type="date" className={fieldClassName} value={form.accrual_period_end ?? ""} onChange={(event) => setField("accrual_period_end", event.target.value)} />
                </FormField>
                <FormField label="Início das férias" required>
                  <input type="date" className={fieldClassName} value={form.vacation_start ?? ""} onChange={(event) => setField("vacation_start", event.target.value)} />
                </FormField>
                <FormField label="Fim das férias" required>
                  <input type="date" className={fieldClassName} value={form.vacation_end ?? ""} onChange={(event) => setField("vacation_end", event.target.value)} />
                </FormField>
                <FormField label="Quantidade de dias" required>
                  <input type="number" min="1" className={fieldClassName} value={form.days_count ?? ""} onChange={(event) => setField("days_count", event.target.value)} />
                </FormField>
              </div>
            </>
          ) : (
            <>
              <FormField label="Tipo de afastamento" required>
                <select
                  className={fieldClassName}
                  value={form.leave_type_id ?? ""}
                  onChange={(event) => setField("leave_type_id", event.target.value)}
                >
                  <option value="">Selecione</option>
                  {data?.leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Data inicial" required>
                  <input type="date" className={fieldClassName} value={form.start_date ?? ""} onChange={(event) => setField("start_date", event.target.value)} />
                </FormField>
                <FormField label="Data final">
                  <input type="date" className={fieldClassName} value={form.end_date ?? ""} onChange={(event) => setField("end_date", event.target.value)} />
                </FormField>
              </div>
            </>
          )}

          <FormField label="Observacoes">
            <textarea
              className={`${fieldClassName} min-h-24`}
              value={form.notes ?? ""}
              onChange={(event) => setField("notes", event.target.value)}
            />
          </FormField>

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
