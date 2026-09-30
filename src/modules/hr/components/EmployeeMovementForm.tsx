"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import {
  calculateMovementTotal,
  defaultMovementCostCategories,
  filterMovementCostCategories,
  type AdmissionEmployeeInput,
  type EmployeeMovementCostItemInput,
  type EmployeeMovementInput,
} from "@/modules/hr/services/movements.service";
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
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { formatCurrencyBRL, toNumber } from "@/modules/hr/utils/labor-cost-calculations";

interface EmployeeMovementFormProps {
  initialMovement?: EmployeeMovement | null;
  employees: Employee[];
  departments?: Department[];
  positions?: Position[];
  employmentTypes?: EmploymentType[];
  statuses?: EmployeeStatus[];
  terminationReasons: TerminationReason[];
  movementCostCategories?: EmployeeMovementCostCategory[];
  lockedEmployeeId?: string;
  lockedMovementType?: EmployeeMovementType;
  onSubmit: (input: EmployeeMovementInput) => Promise<void>;
  onCancel: () => void;
}

interface EditableCostItem extends EmployeeMovementCostItemInput {
  localId: string;
}

const movementStatusOptions: Array<{ value: EmployeeMovementStatus; label: string }> = [
  { value: "planned", label: "Planejado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function newCostItem(): EditableCostItem {
  return {
    localId: crypto.randomUUID(),
    description: "",
    cost_category: "other",
    amount: "",
    is_deduction: false,
    notes: "",
  };
}

function getInitialForm(
  initialMovement?: EmployeeMovement | null,
  lockedEmployeeId?: string,
  lockedMovementType?: EmployeeMovementType,
): EmployeeMovementInput {
  return {
    employee_id: lockedEmployeeId ?? initialMovement?.employee_id ?? "",
    movement_type: lockedMovementType ?? initialMovement?.movement_type ?? (lockedEmployeeId ? "termination" : "admission"),
    movement_date: initialMovement?.movement_date ?? todayInputValue(),
    status: initialMovement?.status ?? "completed",
    termination_reason_id: initialMovement?.termination_reason_id ?? "",
    notes: initialMovement?.notes ?? "",
  };
}

function getInitialAdmissionEmployee(): AdmissionEmployeeInput {
  return {
    full_name: "",
    cpf: "",
    employee_number: "",
    email: "",
    phone: "",
    department_id: "",
    position_id: "",
    employment_type_id: "",
    status_id: "",
  };
}

function getInitialItems(initialMovement?: EmployeeMovement | null): EditableCostItem[] {
  if (!initialMovement?.cost_items?.length) {
    return [newCostItem()];
  }

  return initialMovement.cost_items.map((item) => ({
    localId: item.id,
    id: item.id,
    description: item.description,
    cost_category: item.cost_category,
    amount: item.amount,
    is_deduction: item.is_deduction,
    notes: item.notes ?? "",
    sort_order: item.sort_order,
  }));
}

function normalizeItemsForTotal(items: EditableCostItem[]) {
  return items
    .filter((item) => String(item.description ?? "").trim() || toNumber(item.amount) > 0)
    .map((item) => ({
      amount: toNumber(item.amount),
      is_deduction: Boolean(item.is_deduction),
    }));
}

export function EmployeeMovementForm({
  initialMovement,
  employees,
  departments = [],
  positions = [],
  employmentTypes = [],
  statuses = [],
  terminationReasons,
  movementCostCategories = defaultMovementCostCategories,
  lockedEmployeeId,
  lockedMovementType,
  onSubmit,
  onCancel,
}: EmployeeMovementFormProps) {
  const [form, setForm] = useState<EmployeeMovementInput>(() =>
    getInitialForm(initialMovement, lockedEmployeeId, lockedMovementType),
  );
  const [admissionEmployee, setAdmissionEmployee] = useState<AdmissionEmployeeInput>(() =>
    getInitialAdmissionEmployee(),
  );
  const [items, setItems] = useState<EditableCostItem[]>(() => getInitialItems(initialMovement));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveMovementType = lockedMovementType ?? form.movement_type;
  const isNewAdmission = effectiveMovementType === "admission" && !lockedEmployeeId && !initialMovement;
  const costCategories = useMemo(
    () => {
      const selectedKeys = items.map((item) => String(item.cost_category ?? ""));
      const filteredCategories = filterMovementCostCategories(
        movementCostCategories,
        effectiveMovementType,
        selectedKeys,
      );
      const filteredKeys = new Set(filteredCategories.map((category) => category.key));
      const missingSelectedDefaults = filterMovementCostCategories(
        defaultMovementCostCategories,
        effectiveMovementType,
        selectedKeys,
      ).filter((category) => selectedKeys.includes(category.key) && !filteredKeys.has(category.key));
      const resolvedCategories = [...filteredCategories, ...missingSelectedDefaults];

      return resolvedCategories.length
        ? resolvedCategories
        : filterMovementCostCategories(defaultMovementCostCategories, effectiveMovementType, ["other"]);
    },
    [effectiveMovementType, items, movementCostCategories],
  );
  const total = useMemo(() => calculateMovementTotal(normalizeItemsForTotal(items)), [items]);

  function updateField<K extends keyof EmployeeMovementInput>(key: K, value: EmployeeMovementInput[K]) {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "movement_type" && value === "admission") {
        next.termination_reason_id = "";

        if (!lockedEmployeeId && !initialMovement) {
          next.employee_id = "";
        }
      }

      return next;
    });
  }

  function updateAdmissionEmployeeField<K extends keyof AdmissionEmployeeInput>(
    key: K,
    value: AdmissionEmployeeInput[K],
  ) {
    setAdmissionEmployee((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateItem(localId: string, patch: Partial<EditableCostItem>) {
    setItems((current) => current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const movementType = lockedMovementType ?? form.movement_type;

      await onSubmit({
        ...form,
        employee_id: isNewAdmission ? undefined : lockedEmployeeId ?? form.employee_id,
        admission_employee: isNewAdmission ? admissionEmployee : undefined,
        movement_type: movementType,
        termination_reason_id: movementType === "termination" ? form.termination_reason_id : null,
        cost_items: items.map((item, index) => ({ ...item, sort_order: index })),
      });
    } catch (submitError) {
      setError(toUserFriendlyErrorMessage(submitError, "Não foi possível salvar o movimento."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#f97316]">
          Dados do movimento
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          {!isNewAdmission ? (
            <FormField label={effectiveMovementType === "termination" ? "Colaborador a desligar" : "Colaborador"} required>
              <select
                className={fieldClassName}
                value={lockedEmployeeId ?? form.employee_id ?? ""}
                disabled={Boolean(lockedEmployeeId)}
                onChange={(event) => updateField("employee_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <FormField label="Tipo" required>
            <select
              className={fieldClassName}
              value={lockedMovementType ?? form.movement_type}
              disabled={Boolean(lockedMovementType)}
              onChange={(event) => updateField("movement_type", event.target.value as EmployeeMovementType)}
            >
              <option value="admission">Admissão</option>
              <option value="termination">Desligamento</option>
            </select>
          </FormField>
          <FormField label="Data" required>
            <input
              type="date"
              className={fieldClassName}
              value={form.movement_date}
              onChange={(event) => updateField("movement_date", event.target.value)}
            />
          </FormField>
          <FormField label="Status" required>
            <select
              className={fieldClassName}
              value={form.status}
              onChange={(event) => updateField("status", event.target.value as EmployeeMovementStatus)}
            >
              {movementStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </FormField>
          {effectiveMovementType === "termination" ? (
            <FormField
              label="Motivo do desligamento"
              hint={
                terminationReasons.length
                  ? undefined
                  : "Nenhum motivo de desligamento cadastrado. Cadastre em Configurações do RH > Cadastros > Motivos de desligamento."
              }
            >
              <select
                className={fieldClassName}
                value={form.termination_reason_id ?? ""}
                disabled={!terminationReasons.length}
                onChange={(event) => updateField("termination_reason_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {terminationReasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
        </div>
      </section>

      {isNewAdmission ? (
        <section>
          <div className="mb-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f97316]">
              Novo colaborador
            </h4>
            <p className="mt-1 text-sm text-zinc-500">
              A data do movimento será usada como data de admissão do colaborador.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Nome completo" required>
              <input
                className={fieldClassName}
                value={admissionEmployee.full_name ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("full_name", event.target.value)}
              />
            </FormField>
            <FormField label="CPF" required>
              <input
                className={fieldClassName}
                value={admissionEmployee.cpf ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("cpf", event.target.value)}
              />
            </FormField>
            <FormField label="Matrícula" required>
              <input
                className={fieldClassName}
                value={admissionEmployee.employee_number ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("employee_number", event.target.value)}
              />
            </FormField>
            <FormField label="E-mail">
              <input
                type="email"
                className={fieldClassName}
                value={admissionEmployee.email ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("email", event.target.value)}
              />
            </FormField>
            <FormField label="Telefone">
              <input
                className={fieldClassName}
                value={admissionEmployee.phone ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("phone", event.target.value)}
              />
            </FormField>
            <FormField label="Tipo de vínculo">
              <select
                className={fieldClassName}
                value={admissionEmployee.employment_type_id ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("employment_type_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {employmentTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Departamento">
              <select
                className={fieldClassName}
                value={admissionEmployee.department_id ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("department_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Cargo">
              <select
                className={fieldClassName}
                value={admissionEmployee.position_id ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("position_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {positions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status">
              <select
                className={fieldClassName}
                value={admissionEmployee.status_id ?? ""}
                onChange={(event) => updateAdmissionEmployeeField("status_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {statuses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f97316]">
            Itens de custo
          </h4>
          <button
            type="button"
            onClick={() => setItems((current) => [...current, newCostItem()])}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-[#f97316] hover:text-[#f97316]"
          >
            <Plus className="h-4 w-4" />
            Item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.localId} className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-[1.2fr_1fr_150px_auto_auto]">
              <input
                className={fieldClassName}
                placeholder="Descrição"
                value={item.description ?? ""}
                onChange={(event) => updateItem(item.localId, { description: event.target.value })}
              />
              <select
                className={fieldClassName}
                value={item.cost_category ?? "other"}
                onChange={(event) => updateItem(item.localId, { cost_category: event.target.value })}
              >
                {costCategories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                className={fieldClassName}
                placeholder="0,00"
                value={item.amount ?? ""}
                onChange={(event) => updateItem(item.localId, { amount: event.target.value })}
              />
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(item.is_deduction)}
                  onChange={(event) => updateItem(item.localId, { is_deduction: event.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                />
                Deduz
              </label>
              <button
                type="button"
                onClick={() =>
                  setItems((current) =>
                    current.length === 1 ? [newCostItem()] : current.filter((currentItem) => currentItem.localId !== item.localId),
                  )
                }
                className="grid h-10 w-10 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-red-200 hover:text-red-600"
                title="Remover item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <FormField label="Observações">
          <textarea
            rows={4}
            className={fieldClassName}
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </FormField>
      </section>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Total do movimento</p>
          <p className="font-mono text-2xl font-semibold text-zinc-950">{formatCurrencyBRL(total)}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </form>
  );
}
