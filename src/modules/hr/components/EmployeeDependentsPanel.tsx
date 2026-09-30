"use client";

import { Edit2, Plus, Power, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import {
  createEmployeeDependent,
  deleteEmployeeDependent,
  setEmployeeDependentActive,
  updateEmployeeDependent,
} from "@/modules/hr/services/dependents.service";
import type { DependentRelationshipType, EmployeeDependent, ID } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { formatDate } from "@/modules/hr/utils/format";

interface EmployeeDependentsPanelProps {
  employeeId: ID;
  dependents: EmployeeDependent[];
  relationshipTypes: DependentRelationshipType[];
  canDelete?: boolean;
  onChanged: () => Promise<void>;
}

type DependentFormState = {
  full_name: string;
  relationship_type_id: string;
  birth_date: string;
  document_number: string;
  consider_for_commemorative_dates: boolean;
  consider_as_internal_dependent: boolean;
  notes: string;
  is_active: boolean;
};

const emptyForm: DependentFormState = {
  full_name: "",
  relationship_type_id: "",
  birth_date: "",
  document_number: "",
  consider_for_commemorative_dates: true,
  consider_as_internal_dependent: true,
  notes: "",
  is_active: true,
};

function calculateAge(birthDate?: string | null) {
  if (!birthDate) {
    return "-";
  }

  const today = new Date();
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} ano(s)` : "-";
}

function getDependentInitialForm(dependent?: EmployeeDependent | null): DependentFormState {
  return dependent
    ? {
        full_name: dependent.full_name ?? "",
        relationship_type_id: dependent.relationship_type_id ?? "",
        birth_date: dependent.birth_date ?? "",
        document_number: dependent.document_number ?? "",
        consider_for_commemorative_dates: dependent.consider_for_commemorative_dates,
        consider_as_internal_dependent: dependent.consider_as_internal_dependent,
        notes: dependent.notes ?? "",
        is_active: dependent.is_active,
      }
    : emptyForm;
}

export function EmployeeDependentsPanel({
  employeeId,
  dependents,
  relationshipTypes,
  canDelete = false,
  onChanged,
}: EmployeeDependentsPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<EmployeeDependent | null>(null);
  const [form, setForm] = useState<DependentFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const relationshipById = useMemo(
    () => new Map(relationshipTypes.map((relationship) => [relationship.id, relationship])),
    [relationshipTypes],
  );

  const columns = useMemo<Array<DataTableColumn<EmployeeDependent>>>(
    () => [
      {
        key: "name",
        header: "Nome",
        render: (dependent) => (
          <div>
            <p className="font-medium text-zinc-950">{dependent.full_name}</p>
            {dependent.document_number ? (
              <p className="font-mono text-xs text-zinc-500">{dependent.document_number}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "relationship",
        header: "Parentesco",
        render: (dependent) =>
          dependent.relationship_type?.name ?? dependent.relationship ?? "-",
      },
      {
        key: "birth",
        header: "Nascimento",
        render: (dependent) => formatDate(dependent.birth_date),
      },
      {
        key: "age",
        header: "Idade",
        render: (dependent) => calculateAge(dependent.birth_date),
      },
      {
        key: "commemorative",
        header: "Datas comemorativas",
        render: (dependent) => (
          <StatusBadge
            label={dependent.consider_for_commemorative_dates ? "Considerar" : "Não considerar"}
            status={dependent.consider_for_commemorative_dates ? "ativo" : "inativo"}
          />
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (dependent) => (
          <StatusBadge
            label={dependent.is_active ? "Ativo" : "Inativo"}
            status={dependent.is_active ? "ativo" : "inativo"}
          />
        ),
      },
      {
        key: "actions",
        header: "Ações",
        render: (dependent) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEdit(dependent)}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-[#f97316] hover:text-[#f97316]"
              title="Editar"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                setError(null);

                try {
                  await setEmployeeDependentActive(dependent.id, !dependent.is_active);
                  await onChanged();
                } catch (toggleError) {
                  setError(toUserFriendlyErrorMessage(toggleError, "Não foi possível alterar o dependente."));
                }
              }}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-[#f97316] hover:text-[#f97316]"
              title={dependent.is_active ? "Inativar" : "Reativar"}
            >
              {dependent.is_active ? <Power className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            </button>
            {canDelete ? (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Remover este dependente?")) {
                    setError(null);

                    try {
                      await deleteEmployeeDependent(dependent.id);
                      await onChanged();
                    } catch (deleteError) {
                      setError(toUserFriendlyErrorMessage(deleteError, "Não foi possível remover o dependente."));
                    }
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-red-200 hover:text-red-600"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [canDelete, onChanged],
  );

  function setField(key: keyof DependentFormState, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingDependent(null);
    setForm(emptyForm);
    setError(null);
    setDrawerOpen(true);
  }

  function openEdit(dependent: EmployeeDependent) {
    setEditingDependent(dependent);
    setForm(getDependentInitialForm(dependent));
    setError(null);
    setDrawerOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const relationship = form.relationship_type_id
        ? relationshipById.get(form.relationship_type_id)?.name
        : undefined;
      const payload = {
        employee_id: employeeId,
        full_name: form.full_name,
        relationship_type_id: form.relationship_type_id || undefined,
        relationship,
        birth_date: form.birth_date || undefined,
        document_number: form.document_number || undefined,
        consider_for_commemorative_dates: form.consider_for_commemorative_dates,
        consider_as_internal_dependent: form.consider_as_internal_dependent,
        notes: form.notes || undefined,
        is_active: form.is_active,
      };

      if (editingDependent) {
        await updateEmployeeDependent(editingDependent.id, payload);
      } else {
        await createEmployeeDependent(payload);
      }

      setDrawerOpen(false);
      setEditingDependent(null);
      setForm(emptyForm);
      await onChanged();
    } catch (submitError) {
      setError(toUserFriendlyErrorMessage(submitError, "Não foi possível salvar o dependente."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">
              Base para campanhas internas, datas comemorativas e acoes familiares.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
          >
            <Plus className="h-4 w-4" />
            Novo dependente
          </button>
        </div>

        {error && !drawerOpen ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <DataTable
          data={dependents}
          columns={columns}
          getRowKey={(dependent) => dependent.id}
          emptyState={
            <EmptyState
              title="Nenhum dependente cadastrado"
              description="Cadastre dependentes para apoiar campanhas internas e datas comemorativas."
            />
          }
        />
      </div>

      <DrawerForm
        open={drawerOpen}
        title={editingDependent ? "Editar dependente" : "Novo dependente"}
        description="Documento/CPF e opcional nesta etapa."
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <FormField label="Nome completo" required>
            <input
              className={fieldClassName}
              value={form.full_name}
              onChange={(event) => setField("full_name", event.target.value)}
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Parentesco">
              <select
                className={fieldClassName}
                value={form.relationship_type_id}
                onChange={(event) => setField("relationship_type_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {relationshipTypes.map((relationship) => (
                  <option key={relationship.id} value={relationship.id}>
                    {relationship.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Data de nascimento">
              <input
                type="date"
                className={fieldClassName}
                value={form.birth_date}
                onChange={(event) => setField("birth_date", event.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Documento">
            <input
              className={fieldClassName}
              value={form.document_number}
              onChange={(event) => setField("document_number", event.target.value)}
            />
          </FormField>

          <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.consider_for_commemorative_dates}
                onChange={(event) => setField("consider_for_commemorative_dates", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
              />
              Considerar em datas comemorativas
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.consider_as_internal_dependent}
                onChange={(event) => setField("consider_as_internal_dependent", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
              />
              Considerar como dependente interno
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setField("is_active", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
              />
              Ativo
            </label>
          </div>

          <FormField label="Observacoes">
            <textarea
              className={`${fieldClassName} min-h-24`}
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-5">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c] disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar dependente"}
            </button>
          </div>
        </form>
      </DrawerForm>
    </>
  );
}
