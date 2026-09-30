"use client";

import {
  Calculator,
  CheckCircle2,
  Copy,
  Edit2,
  Plus,
  Power,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { MetricCard } from "@/modules/hr/components/MetricCard";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import {
  addEmployeeCostComponent,
  cancelMonthlyCostEvent,
  closeMonthlyEmployeeCost,
  createEmployeeCompensation,
  createMonthlyCostEvent,
  copyEmployeeCostSettings,
  type CopyEmployeeCostSettingsResult,
  getEmployeeLaborCostProfile,
  inactivateEmployeeCompensation,
  inactivateEmployeeCostComponent,
  removeEmployeeCostComponent,
  reopenMonthlyEmployeeCost,
  saveMonthlyEmployeeCost,
  updateEmployeeCompensation,
  updateEmployeeCostComponent,
  updateMonthlyCostEvent,
} from "@/modules/hr/services/labor-costs.service";
import type {
  CostCalculationType,
  CostComponent,
  Employee,
  EmployeeCompensation,
  EmployeeCostComponent,
  EmployeeMonthlyCostEvent,
  MonthlyCostEventSource,
  MonthlyCostEventStatus,
  MonthlyEmployeeCost,
} from "@/modules/hr/types";
import { formatDate, formatDateTime } from "@/modules/hr/utils/format";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import {
  formatCurrencyBRL,
  formatDecimalBR,
  getDefaultReferenceMonth,
  getReferenceMonthInputValue,
  requiresManualCostInput,
  type CalculatedCostComponent,
} from "@/modules/hr/utils/labor-cost-calculations";

const eventSourceLabels: Record<MonthlyCostEventSource, string> = {
  manual: "Manual",
  occurrence: "Ocorrência",
  import: "Importação",
  automatic_calculation: "Cálculo automático",
  financial_adjustment: "Ajuste financeiro",
};

const eventStatusLabels: Record<MonthlyCostEventStatus, string> = {
  pending: "Pendente",
  included: "Considerado",
  ignored: "Ignorado",
  cancelled: "Cancelado",
};

const closingStatusLabels: Record<string, string> = {
  estimated: "Calculado",
  reviewing: "Em conferência",
  closed: "Fechado",
  reopened: "Reaberto",
  cancelled: "Cancelado",
};

const calculationTypeLabels: Record<CostCalculationType, string> = {
  fixed_monthly: "Valor fixo mensal",
  daily_value: "Valor diário",
  hourly_value: "Valor por hora",
  percentage_base_salary: "Percentual sobre salário-base",
  percentage_total_compensation: "Percentual sobre remuneração",
  percentage_component: "Percentual sobre componente",
  manual_monthly: "Valor manual no mês",
  formula: "Fórmula simples",
};

type DrawerMode = "compensation" | "component" | "event" | "copy" | null;
type CostForm = Record<string, string | boolean>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function checkboxClassName() {
  return "h-4 w-4 rounded border-zinc-300 text-[#f97316]";
}

function getComponentValueLabel(item: EmployeeCostComponent) {
  const component = item.cost_component;
  const parts = [
    item.value !== null && item.value !== undefined ? formatCurrencyBRL(item.value) : null,
    item.percentage !== null && item.percentage !== undefined ? `${formatDecimalBR(item.percentage)}%` : null,
    item.quantity !== null && item.quantity !== undefined ? `Qtd. ${formatDecimalBR(item.quantity)}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : component?.name ?? "-";
}

function getCalculatedComponentValueLabel(item: CalculatedCostComponent) {
  const parts = [
    item.amount ? formatCurrencyBRL(item.amount) : formatCurrencyBRL(0),
    item.component.default_percentage !== null && item.component.default_percentage !== undefined
      ? `${formatDecimalBR(item.component.default_percentage)}%`
      : null,
    item.employeeComponent?.percentage !== null && item.employeeComponent?.percentage !== undefined
      ? `${formatDecimalBR(item.employeeComponent.percentage)}%`
      : null,
  ].filter(Boolean);

  return parts.join(" / ");
}

interface EmployeeLaborCostsPanelProps {
  employee: Employee;
  canDelete?: boolean;
}

export function EmployeeLaborCostsPanel({ employee, canDelete = false }: EmployeeLaborCostsPanelProps) {
  const [referenceMonth, setReferenceMonth] = useState(getDefaultReferenceMonth().slice(0, 7));
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [editingCompensation, setEditingCompensation] = useState<EmployeeCompensation | null>(null);
  const [editingComponent, setEditingComponent] = useState<EmployeeCostComponent | null>(null);
  const [editingEvent, setEditingEvent] = useState<EmployeeMonthlyCostEvent | null>(null);
  const [removingComponent, setRemovingComponent] = useState<EmployeeCostComponent | null>(null);
  const [copyResult, setCopyResult] = useState<CopyEmployeeCostSettingsResult | null>(null);
  const [form, setForm] = useState<CostForm>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncResource(
    () => getEmployeeLaborCostProfile(employee, referenceMonth),
    `${employee.id}-${referenceMonth}`,
  );
  const selectableCostComponents = useMemo(
    () => data?.costComponents.filter((component) => component.key !== "salario_base") ?? [],
    [data?.costComponents],
  );

  const compensationColumns = useMemo<Array<DataTableColumn<EmployeeCompensation>>>(
    () => [
      { key: "salary", header: "Salário-base", render: (item) => formatCurrencyBRL(item.base_salary) },
      { key: "hours", header: "Jornada", render: (item) => `${formatDecimalBR(item.monthly_hours)} h` },
      { key: "hour_rate", header: "Valor hora", render: (item) => formatCurrencyBRL(item.hourly_base_rate) },
      {
        key: "period",
        header: "Vigência",
        render: (item) =>
          `${formatDate(item.effective_from)}${item.effective_until ? ` até ${formatDate(item.effective_until)}` : ""}`,
      },
      {
        key: "status",
        header: "Status",
        render: (item) => (
          <StatusBadge label={item.is_active ? "Ativo" : "Inativo"} status={item.is_active ? "ativo" : "inativo"} />
        ),
      },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openCompensation(item)}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
              title="Editar"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {item.is_active ? (
              <button
                type="button"
                onClick={async () => {
                  setActionError(null);
                  setActionMessage(null);

                  try {
                    await inactivateEmployeeCompensation(item.id);
                    await reload();
                  } catch (inactiveError) {
                    setActionError(
                      toUserFriendlyErrorMessage(inactiveError, "Não foi possível inativar a remuneração."),
                    );
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
                title="Inativar"
              >
                <Power className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [reload],
  );

  const componentColumns: Array<DataTableColumn<EmployeeCostComponent>> = [
      {
        key: "component",
        header: "Componente",
        render: (item) => (
          <div>
            <p className="font-semibold text-zinc-950">{item.cost_component?.name ?? "-"}</p>
            <p className="text-xs text-zinc-500">{item.cost_component?.category?.name ?? "-"}</p>
          </div>
        ),
      },
      { key: "calculation", header: "Valor", render: getComponentValueLabel },
      {
        key: "period",
        header: "Vigência",
        render: (item) =>
          `${formatDate(item.effective_from)}${item.effective_until ? ` até ${formatDate(item.effective_until)}` : ""}`,
      },
      {
        key: "status",
        header: "Status",
        render: (item) => (
          <StatusBadge label={item.is_active ? "Ativo" : "Inativo"} status={item.is_active ? "ativo" : "inativo"} />
        ),
      },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openComponent(item)}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
              title="Editar"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {item.is_active ? (
              <button
                type="button"
                onClick={async () => {
                  setActionError(null);
                  setActionMessage(null);

                  try {
                    await inactivateEmployeeCostComponent(item.id);
                    await reload();
                  } catch (inactiveError) {
                    setActionError(
                      toUserFriendlyErrorMessage(inactiveError, "Não foi possível inativar o componente."),
                    );
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
                title="Inativar"
              >
                <Power className="h-4 w-4" />
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => setRemovingComponent(item)}
                className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-red-300 hover:text-red-600"
                title="Remover vínculo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ),
      },
    ];

  const eventColumns: Array<DataTableColumn<EmployeeMonthlyCostEvent>> = [
      {
        key: "event",
        header: "Evento",
        render: (item) => (
          <div>
            <p className="font-semibold text-zinc-950">{item.description}</p>
            <p className="text-xs text-zinc-500">{item.cost_component?.name ?? "-"}</p>
          </div>
        ),
      },
      { key: "quantity", header: "Qtd.", render: (item) => formatDecimalBR(item.quantity) },
      { key: "unit", header: "Unitário", render: (item) => formatCurrencyBRL(item.unit_value) },
      { key: "total", header: "Total", render: (item) => formatCurrencyBRL(item.total_value) },
      {
        key: "source",
        header: "Origem",
        render: (item) => eventSourceLabels[item.source] ?? item.source,
      },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={eventStatusLabels[item.status]} status={item.status} />,
      },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openEvent(item)}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
              title="Editar"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {!["cancelled", "ignored"].includes(item.status) ? (
              <button
                type="button"
                onClick={async () => {
                  setActionError(null);
                  setActionMessage(null);

                  try {
                    await cancelMonthlyCostEvent(item.id);
                    await reload();
                  } catch (cancelError) {
                    setActionError(
                      toUserFriendlyErrorMessage(cancelError, "Não foi possível cancelar o evento mensal."),
                    );
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-red-300 hover:text-red-600"
                title="Cancelar"
              >
                <XCircle className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ),
      },
    ];

  const compositionColumns: Array<DataTableColumn<CalculatedCostComponent>> = [
    {
      key: "component",
      header: "Componente",
      render: (item) => (
        <div>
          <p className="font-semibold text-zinc-950">{item.component.name}</p>
          <p className="text-xs text-zinc-500">{item.component.category?.name ?? "-"}</p>
        </div>
      ),
    },
    {
      key: "calculation",
      header: "Cálculo",
      render: (item) => calculationTypeLabels[item.calculationType],
    },
    {
      key: "value",
      header: "Valor",
      render: getCalculatedComponentValueLabel,
    },
  ];

  const closingColumns = useMemo<Array<DataTableColumn<MonthlyEmployeeCost>>>(
    () => [
      { key: "month", header: "Competência", render: (item) => item.reference_month.slice(0, 7).split("-").reverse().join("/") },
      { key: "total", header: "Custo total", render: (item) => formatCurrencyBRL(item.total_company_cost) },
      { key: "hour", header: "Custo hora", render: (item) => formatCurrencyBRL(item.contractual_hour_cost) },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={closingStatusLabels[item.status]} status={item.status} />,
      },
      { key: "updated", header: "Calculado em", render: (item) => formatDateTime(item.calculated_at) },
      {
        key: "actions",
        header: "Ações",
        render: (item) => (
          <div className="flex gap-2">
            {item.status === "closed" ? (
              <button
                type="button"
                onClick={async () => {
                  setActionError(null);
                  setActionMessage(null);

                  try {
                    await reopenMonthlyEmployeeCost(item.id);
                    await reload();
                  } catch (reopenError) {
                    setActionError(
                      toUserFriendlyErrorMessage(reopenError, "Não foi possível reabrir o fechamento."),
                    );
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
                title="Reabrir"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  setActionError(null);
                  setActionMessage(null);

                  try {
                    await closeMonthlyEmployeeCost(item.id);
                    await reload();
                  } catch (closeError) {
                    setActionError(
                      toUserFriendlyErrorMessage(closeError, "Não foi possível fechar a competência."),
                    );
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-emerald-300 hover:text-emerald-600"
                title="Fechar"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [reload],
  );

  function setField(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function getDefaultCalculationType(componentId: string) {
    const selectedComponent = selectableCostComponents.find((component) => component.id === componentId);

    return selectedComponent && requiresManualCostInput(selectedComponent) ? "fixed_monthly" : "";
  }

  function setCostComponent(componentId: string) {
    setForm((current) => ({
      ...current,
      cost_component_id: componentId,
      calculation_type: getDefaultCalculationType(componentId),
    }));
  }

  function openCompensation(item?: EmployeeCompensation) {
    setDrawerMode("compensation");
    setEditingCompensation(item ?? null);
    setEditingComponent(null);
    setEditingEvent(null);
    setForm(
      item
        ? {
            base_salary: String(item.base_salary),
            monthly_hours: String(item.monthly_hours),
            effective_from: item.effective_from,
            effective_until: item.effective_until ?? "",
            notes: item.notes ?? "",
            is_active: item.is_active,
          }
        : {
            base_salary: "",
            monthly_hours: "220",
            effective_from: today(),
            effective_until: "",
            notes: "",
            is_active: true,
          },
    );
    setFormError(null);
  }

  function openComponent(item?: EmployeeCostComponent) {
    const defaultComponentId = selectableCostComponents[0]?.id ?? "";

    setDrawerMode("component");
    setEditingComponent(item ?? null);
    setEditingCompensation(null);
    setEditingEvent(null);
    setForm(
      item
        ? {
            cost_component_id: item.cost_component_id,
            calculation_type: item.calculation_type ?? "",
            value: item.value !== null && item.value !== undefined ? String(item.value) : "",
            percentage: item.percentage !== null && item.percentage !== undefined ? String(item.percentage) : "",
            quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : "",
            effective_from: item.effective_from,
            effective_until: item.effective_until ?? "",
            notes: item.notes ?? "",
            is_active: item.is_active,
          }
        : {
            cost_component_id: defaultComponentId,
            calculation_type: getDefaultCalculationType(defaultComponentId),
            value: "",
            percentage: "",
            quantity: "",
            effective_from: today(),
            effective_until: "",
            notes: "",
            is_active: true,
          },
    );
    setFormError(null);
  }

  function openEvent(item?: EmployeeMonthlyCostEvent) {
    const defaultComponentId = selectableCostComponents[0]?.id ?? "";

    setDrawerMode("event");
    setEditingEvent(item ?? null);
    setEditingCompensation(null);
    setEditingComponent(null);
    setForm(
      item
        ? {
            cost_component_id: item.cost_component_id,
            reference_month: getReferenceMonthInputValue(item.reference_month),
            description: item.description,
            quantity: String(item.quantity),
            unit_value: String(item.unit_value),
            total_value: String(item.total_value),
            source: item.source,
            status: item.status,
            notes: item.notes ?? "",
          }
        : {
            cost_component_id: defaultComponentId,
            reference_month: referenceMonth,
            description: "",
            quantity: "1",
            unit_value: "",
            total_value: "",
            source: "manual",
            status: "pending",
            notes: "",
          },
    );
    setFormError(null);
  }

  function openCopySettings() {
    const defaultSourceEmployee = data?.employees.find((item) => item.id !== employee.id);

    setDrawerMode("copy");
    setEditingCompensation(null);
    setEditingComponent(null);
    setEditingEvent(null);
    setCopyResult(null);
    setForm({
      source_employee_id: defaultSourceEmployee?.id ?? "",
      target_employee_id: employee.id,
      effective_from: today(),
      mode: "merge",
      copy_compensation: true,
      copy_monthly_hours: true,
      copy_cost_components: true,
      copy_benefits: true,
      copy_allowances: true,
      copy_charges_provisions: true,
      copy_attendance_rules: false,
      copy_notes: false,
    });
    setFormError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setActionMessage(null);

    try {
      if (drawerMode === "compensation") {
        const payload = {
          employee_id: employee.id,
          base_salary: String(form.base_salary ?? ""),
          monthly_hours: String(form.monthly_hours ?? ""),
          employment_type_id: employee.employment_type_id ?? null,
          effective_from: String(form.effective_from ?? ""),
          effective_until: String(form.effective_until ?? ""),
          notes: String(form.notes ?? ""),
          is_active: form.is_active !== false,
        };

        if (editingCompensation) {
          await updateEmployeeCompensation(editingCompensation.id, payload);
        } else {
          await createEmployeeCompensation(payload);
        }
      }

      if (drawerMode === "component") {
        const calculationType = String(form.calculation_type ?? "") || null;
        const payload = {
          employee_id: employee.id,
          cost_component_id: String(form.cost_component_id ?? ""),
          calculation_type: calculationType as CostCalculationType | null,
          value: String(form.value ?? ""),
          percentage: String(form.percentage ?? ""),
          quantity: String(form.quantity ?? ""),
          effective_from: String(form.effective_from ?? ""),
          effective_until: String(form.effective_until ?? ""),
          notes: String(form.notes ?? ""),
          is_active: form.is_active !== false,
        };

        if (editingComponent) {
          await updateEmployeeCostComponent(editingComponent.id, payload);
        } else {
          await addEmployeeCostComponent(payload);
        }
      }

      if (drawerMode === "event") {
        const payload = {
          employee_id: employee.id,
          reference_month: String(form.reference_month ?? referenceMonth),
          cost_component_id: String(form.cost_component_id ?? ""),
          description: String(form.description ?? ""),
          quantity: String(form.quantity ?? ""),
          unit_value: String(form.unit_value ?? ""),
          total_value: String(form.total_value ?? ""),
          source: String(form.source ?? "manual") as MonthlyCostEventSource,
          status: String(form.status ?? "pending") as MonthlyCostEventStatus,
          notes: String(form.notes ?? ""),
        };

        if (editingEvent) {
          await updateMonthlyCostEvent(editingEvent.id, payload);
        } else {
          await createMonthlyCostEvent(payload);
        }
      }

      if (drawerMode === "copy") {
        const result = await copyEmployeeCostSettings(
          String(form.source_employee_id ?? ""),
          String(form.target_employee_id ?? employee.id),
          {
            copyCompensation: Boolean(form.copy_compensation),
            copyMonthlyHours: Boolean(form.copy_monthly_hours),
            copyCostComponents: Boolean(form.copy_cost_components),
            copyBenefits: Boolean(form.copy_benefits),
            copyAllowances: Boolean(form.copy_allowances),
            copyChargesAndProvisions: Boolean(form.copy_charges_provisions),
            copyAttendanceRules: Boolean(form.copy_attendance_rules),
            copyNotes: Boolean(form.copy_notes),
            mode: String(form.mode ?? "merge") === "replace" ? "replace" : "merge",
            effectiveFrom: String(form.effective_from ?? ""),
          },
        );
        setCopyResult(result);
        setActionMessage("Configurações de custo copiadas com sucesso.");
      }

      setDrawerMode(null);
      await reload();
    } catch (submitError) {
      setFormError(toUserFriendlyErrorMessage(submitError, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  async function saveEstimate(closeAfterSave = false) {
    if (!data) {
      return;
    }

    setActionError(null);

    try {
      const saved = await saveMonthlyEmployeeCost(data.summary);

      if (closeAfterSave) {
        await closeMonthlyEmployeeCost(saved.id);
      }

      await reload();
    } catch (saveError) {
      setActionError(toUserFriendlyErrorMessage(saveError, "Não foi possível salvar o fechamento."));
    }
  }

  async function confirmRemoveComponent() {
    if (!removingComponent) {
      return;
    }

    setSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await removeEmployeeCostComponent(removingComponent.id);
      setRemovingComponent(null);
      setActionMessage("Componente removido do colaborador com sucesso.");
      await reload();
    } catch (removeError) {
      setActionError(toUserFriendlyErrorMessage(removeError, "Não foi possível remover o componente."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Competência">
        <div className="grid gap-4 md:grid-cols-[220px_auto] md:items-end">
          <FormField label="Mês de referência">
            <input
              type="month"
              className={fieldClassName}
              value={referenceMonth}
              onChange={(event) => setReferenceMonth(event.target.value)}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveEstimate(false)}
              disabled={!data}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-60"
            >
              <Calculator className="h-4 w-4" />
              Salvar custo do mês
            </button>
            <button
              type="button"
              onClick={() => saveEstimate(true)}
              disabled={!data}
              className="inline-flex items-center gap-2 rounded-md bg-[#111316] px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Fechar mês
            </button>
            <button
              type="button"
              onClick={openCopySettings}
              disabled={!data}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-60"
            >
              <Copy className="h-4 w-4" />
              Copiar configurações
            </button>
          </div>
        </div>
      </SectionCard>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {actionError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      ) : null}
      {actionMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {actionMessage}
          {copyResult ? (
            <span className="ml-1">
              Remuneração criada: {copyResult.compensationCreated ? "Sim" : "Não"}. Componentes copiados:{" "}
              {copyResult.componentsCopied}. Ignorados: {copyResult.componentsIgnored}. Substituídos:{" "}
              {copyResult.componentsReplaced}.
            </span>
          ) : null}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Salário-base" value={formatCurrencyBRL(data.summary.baseSalary)} tone="neutral" />
            <MetricCard label="Custo mensal" value={formatCurrencyBRL(data.summary.totalCompanyCost)} tone="warning" />
            <MetricCard label="Custo hora contratual" value={formatCurrencyBRL(data.summary.contractualHourCost)} tone="info" />
            <MetricCard label="Custo hora trabalhada" value={formatCurrencyBRL(data.summary.workedHourCost)} tone="info" />
            <MetricCard label="Benefícios" value={formatCurrencyBRL(data.summary.benefitsTotal)} tone="success" />
            <MetricCard label="Ajudas de custo" value={formatCurrencyBRL(data.summary.allowancesTotal)} tone="success" />
            <MetricCard
              label="Encargos e provisões"
              value={formatCurrencyBRL(data.summary.employerChargesTotal + data.summary.provisionsTotal)}
              tone="warning"
            />
            <MetricCard label="Provisões totais" value={formatCurrencyBRL(data.summary.provisionsTotal)} tone="warning" />
            <MetricCard label="Eventos variáveis" value={formatCurrencyBRL(data.summary.variableEventsTotal)} tone="neutral" />
          </div>

          <SectionCard title="Composição do custo mensal">
            <DataTable
              data={data.summary.components}
              columns={compositionColumns}
              getRowKey={(item) => item.component.id}
              emptyState={<EmptyState title="Nenhum componente calculado" />}
            />
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard
              title="Histórico de remuneração"
              actions={
                <button
                  type="button"
                  onClick={() => openCompensation()}
                  className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
                >
                  <Plus className="h-4 w-4" />
                  Nova remuneração
                </button>
              }
            >
              <DataTable
                data={data.compensations}
                columns={compensationColumns}
                getRowKey={(item) => item.id}
                emptyState={<EmptyState title="Nenhuma remuneração cadastrada" />}
              />
            </SectionCard>

            <SectionCard
              title="Componentes vinculados"
              actions={
                <button
                  type="button"
                  onClick={() => openComponent()}
                  className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
                >
                  <Plus className="h-4 w-4" />
                  Vincular componente
                </button>
              }
            >
              <DataTable
                data={data.employeeComponents}
                columns={componentColumns}
                getRowKey={(item) => item.id}
                emptyState={<EmptyState title="Nenhum componente vinculado" />}
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Eventos mensais"
            actions={
              <button
                type="button"
                onClick={() => openEvent()}
                className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
              >
                <Plus className="h-4 w-4" />
                Novo evento
              </button>
            }
          >
            <DataTable
              data={data.events}
              columns={eventColumns}
              getRowKey={(item) => item.id}
              emptyState={<EmptyState title="Nenhum evento mensal cadastrado" />}
            />
          </SectionCard>

          <SectionCard title="Fechamentos mensais">
            <DataTable
              data={data.monthlyCosts}
              columns={closingColumns}
              getRowKey={(item) => item.id}
              emptyState={<EmptyState title="Nenhum fechamento salvo" />}
            />
          </SectionCard>
        </>
      ) : null}

      <DrawerForm
        open={drawerMode !== null}
        title={
          drawerMode === "compensation"
            ? editingCompensation
              ? "Editar remuneração"
              : "Nova remuneração"
            : drawerMode === "component"
              ? editingComponent
                ? "Editar componente vinculado"
                : "Vincular componente"
              : drawerMode === "copy"
                ? "Copiar configurações de custo"
              : editingEvent
                ? "Editar evento mensal"
                : "Novo evento mensal"
        }
        description={employee.full_name}
        onClose={() => setDrawerMode(null)}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          {drawerMode === "compensation" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Salário-base" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClassName}
                  value={String(form.base_salary ?? "")}
                  onChange={(event) => setField("base_salary", event.target.value)}
                />
              </FormField>
              <FormField label="Jornada mensal" required>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className={fieldClassName}
                  value={String(form.monthly_hours ?? "")}
                  onChange={(event) => setField("monthly_hours", event.target.value)}
                />
              </FormField>
              <FormField label="Início da vigência" required>
                <input
                  type="date"
                  className={fieldClassName}
                  value={String(form.effective_from ?? "")}
                  onChange={(event) => setField("effective_from", event.target.value)}
                />
              </FormField>
              <FormField label="Fim da vigência">
                <input
                  type="date"
                  className={fieldClassName}
                  value={String(form.effective_until ?? "")}
                  onChange={(event) => setField("effective_until", event.target.value)}
                />
              </FormField>
            </div>
          ) : null}

          {drawerMode === "component" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Componente" required>
                <select
                  className={fieldClassName}
                  value={String(form.cost_component_id ?? "")}
                  onChange={(event) => setCostComponent(event.target.value)}
                >
                  {selectableCostComponents.map((component: CostComponent) => (
                    <option key={component.id} value={component.id}>
                      {component.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Tipo de cálculo">
                <select
                  className={fieldClassName}
                  value={String(form.calculation_type ?? "")}
                  onChange={(event) => setField("calculation_type", event.target.value)}
                >
                  <option value="">Padrão do componente</option>
                  {Object.entries(calculationTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Valor">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClassName}
                  value={String(form.value ?? "")}
                  onChange={(event) => setField("value", event.target.value)}
                />
              </FormField>
              <FormField label="Percentual">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  className={fieldClassName}
                  value={String(form.percentage ?? "")}
                  onChange={(event) => setField("percentage", event.target.value)}
                />
              </FormField>
              <FormField label="Quantidade">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  className={fieldClassName}
                  value={String(form.quantity ?? "")}
                  onChange={(event) => setField("quantity", event.target.value)}
                />
              </FormField>
              <FormField label="Início da vigência" required>
                <input
                  type="date"
                  className={fieldClassName}
                  value={String(form.effective_from ?? "")}
                  onChange={(event) => setField("effective_from", event.target.value)}
                />
              </FormField>
              <FormField label="Fim da vigência">
                <input
                  type="date"
                  className={fieldClassName}
                  value={String(form.effective_until ?? "")}
                  onChange={(event) => setField("effective_until", event.target.value)}
                />
              </FormField>
            </div>
          ) : null}

          {drawerMode === "event" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Competência" required>
                <input
                  type="month"
                  className={fieldClassName}
                  value={String(form.reference_month ?? referenceMonth)}
                  onChange={(event) => setField("reference_month", event.target.value)}
                />
              </FormField>
              <FormField label="Componente" required>
                <select
                  className={fieldClassName}
                  value={String(form.cost_component_id ?? "")}
                  onChange={(event) => setField("cost_component_id", event.target.value)}
                >
                  {selectableCostComponents.map((component: CostComponent) => (
                    <option key={component.id} value={component.id}>
                      {component.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Descrição" required>
                <input
                  className={fieldClassName}
                  value={String(form.description ?? "")}
                  onChange={(event) => setField("description", event.target.value)}
                />
              </FormField>
              <FormField label="Quantidade">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  className={fieldClassName}
                  value={String(form.quantity ?? "")}
                  onChange={(event) => setField("quantity", event.target.value)}
                />
              </FormField>
              <FormField label="Valor unitário">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClassName}
                  value={String(form.unit_value ?? "")}
                  onChange={(event) => setField("unit_value", event.target.value)}
                />
              </FormField>
              <FormField label="Valor total">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClassName}
                  value={String(form.total_value ?? "")}
                  onChange={(event) => setField("total_value", event.target.value)}
                />
              </FormField>
              <FormField label="Origem">
                <select
                  className={fieldClassName}
                  value={String(form.source ?? "manual")}
                  onChange={(event) => setField("source", event.target.value)}
                >
                  {Object.entries(eventSourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <select
                  className={fieldClassName}
                  value={String(form.status ?? "pending")}
                  onChange={(event) => setField("status", event.target.value)}
                >
                  {Object.entries(eventStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          ) : null}

          {drawerMode === "copy" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Colaborador de origem" required>
                  <select
                    className={fieldClassName}
                    value={String(form.source_employee_id ?? "")}
                    onChange={(event) => setField("source_employee_id", event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {data?.employees.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Colaborador de destino" required>
                  <select
                    className={fieldClassName}
                    value={String(form.target_employee_id ?? employee.id)}
                    onChange={(event) => setField("target_employee_id", event.target.value)}
                  >
                    {data?.employees.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Início da vigência" required>
                  <input
                    type="date"
                    className={fieldClassName}
                    value={String(form.effective_from ?? "")}
                    onChange={(event) => setField("effective_from", event.target.value)}
                  />
                </FormField>
                <FormField label="Modo de aplicação">
                  <select
                    className={fieldClassName}
                    value={String(form.mode ?? "merge")}
                    onChange={(event) => setField("mode", event.target.value)}
                  >
                    <option value="merge">Mesclar com configurações existentes</option>
                    <option value="replace">Substituir configurações ativas do destino</option>
                  </select>
                </FormField>
              </div>

              <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-2">
                {[
                  ["copy_compensation", "Copiar salário-base"],
                  ["copy_monthly_hours", "Copiar jornada mensal"],
                  ["copy_benefits", "Copiar benefícios"],
                  ["copy_allowances", "Copiar ajudas de custo"],
                  ["copy_charges_provisions", "Copiar encargos e provisões"],
                  ["copy_cost_components", "Copiar demais componentes recorrentes"],
                  ["copy_attendance_rules", "Copiar regras de assiduidade"],
                  ["copy_notes", "Copiar observações"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form[key])}
                      onChange={(event) => setField(key, event.target.checked)}
                      className={checkboxClassName()}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-950">Prévia da cópia</p>
                <p className="mt-1">
                  Serão copiadas as opções marcadas acima, com vigência a partir de{" "}
                  {String(form.effective_from ?? "") || "data selecionada"}.
                </p>
                <p className="mt-1">
                  Eventos mensais, fechamentos, auditoria, ocorrências e valores já fechados não serão copiados.
                </p>
              </div>
            </div>
          ) : null}

          {drawerMode !== "copy" ? (
            <FormField label="Observações">
              <textarea
                className={`${fieldClassName} min-h-24`}
                value={String(form.notes ?? "")}
                onChange={(event) => setField("notes", event.target.value)}
              />
            </FormField>
          ) : null}

          {drawerMode === "compensation" || drawerMode === "component" ? (
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.is_active !== false}
                onChange={(event) => setField("is_active", event.target.checked)}
                className={checkboxClassName()}
              />
              Ativo
            </label>
          ) : null}

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
              {saving ? "Processando..." : drawerMode === "copy" ? "Copiar configurações" : "Salvar"}
            </button>
          </div>
        </form>
      </DrawerForm>

      {removingComponent ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cancelar remoção"
            className="absolute inset-0 h-full w-full bg-black/40"
            onClick={() => setRemovingComponent(null)}
          />
          <div className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-950">Remover componente do colaborador</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Deseja remover este componente de custo do colaborador?
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Essa ação remove o vínculo atual e não altera fechamentos mensais já salvos.
            </p>
            <p className="mt-3 rounded-md bg-zinc-50 p-3 text-sm font-medium text-zinc-800">
              {removingComponent.cost_component?.name ?? "Componente"}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemovingComponent(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRemoveComponent}
                disabled={saving}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Removendo..." : "Remover componente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
