"use client";

import { Edit2, Plus, Power, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { Tabs } from "@/modules/hr/components/Tabs";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import {
  createCostComponent,
  createCostComponentCategory,
  inactivateCostComponent,
  inactivateCostComponentCategory,
  listCostComponentCategories,
  listCostComponents,
  reactivateCostComponent,
  updateCostComponent,
  updateCostComponentCategory,
} from "@/modules/hr/services/labor-costs.service";
import { listSettingItems } from "@/modules/hr/services/settings.service";
import type {
  CostAppliesTo,
  CostCalculationType,
  CostComponent,
  CostComponentCategory,
  Department,
  EmploymentType,
  Position,
} from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import {
  formatCurrencyBRL,
  formatPercentageBR,
} from "@/modules/hr/utils/labor-cost-calculations";

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

const appliesToLabels: Record<CostAppliesTo, string> = {
  all_employees: "Todos",
  employment_type: "Tipo de vínculo",
  department: "Departamento",
  position: "Cargo",
  specific_employee: "Colaborador",
  manual: "Manual",
};

interface LaborCostSettingsData {
  categories: CostComponentCategory[];
  components: CostComponent[];
  departments: Department[];
  positions: Position[];
  employmentTypes: EmploymentType[];
}

type DrawerMode = "category" | "component" | null;
type SettingsForm = Record<string, string | boolean>;

async function loadLaborCostSettingsData(): Promise<LaborCostSettingsData> {
  const [categories, components, departments, positions, employmentTypes] = await Promise.all([
    listCostComponentCategories(true),
    listCostComponents({ includeInactive: true }),
    listSettingItems("departments"),
    listSettingItems("positions"),
    listSettingItems("employment_types"),
  ]);

  return {
    categories,
    components,
    departments: departments as Department[],
    positions: positions as Position[],
    employmentTypes: employmentTypes as EmploymentType[],
  };
}

function getDefaultDisplay(component: CostComponent) {
  if (component.default_percentage !== null && component.default_percentage !== undefined) {
    return formatPercentageBR(component.default_percentage);
  }

  return formatCurrencyBRL(component.default_value ?? 0);
}

function checkboxClassName() {
  return "h-4 w-4 rounded border-zinc-300 text-[#f97316]";
}

export function LaborCostSettingsPanel() {
  const { data, loading, error, reload } = useAsyncResource(loadLaborCostSettingsData);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [editingCategory, setEditingCategory] = useState<CostComponentCategory | null>(null);
  const [editingComponent, setEditingComponent] = useState<CostComponent | null>(null);
  const [form, setForm] = useState<SettingsForm>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categoryColumns = useMemo<Array<DataTableColumn<CostComponentCategory>>>(
    () => [
      {
        key: "name",
        header: "Categoria",
        render: (item) => (
          <div>
            <p className="font-semibold text-zinc-950">{item.name}</p>
            <p className="font-mono text-xs text-zinc-500">{item.key}</p>
          </div>
        ),
      },
      { key: "description", header: "Descrição", render: (item) => item.description ?? "-" },
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
              onClick={() => openCategory(item)}
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

                  try {
                    await inactivateCostComponentCategory(item.id);
                    await reload();
                  } catch (inactiveError) {
                    setActionError(toUserFriendlyErrorMessage(inactiveError, "Não foi possível inativar a categoria."));
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

  const componentColumns: Array<DataTableColumn<CostComponent>> = [
      {
        key: "name",
        header: "Componente",
        render: (item) => (
          <div>
            <p className="font-semibold text-zinc-950">{item.name}</p>
            <p className="font-mono text-xs text-zinc-500">{item.key}</p>
          </div>
        ),
      },
      { key: "category", header: "Categoria", render: (item) => item.category?.name ?? "-" },
      {
        key: "calculation",
        header: "Cálculo",
        render: (item) => (
          <div>
            <p>{calculationTypeLabels[item.calculation_type]}</p>
            <p className="text-xs text-zinc-500">{appliesToLabels[item.applies_to]}</p>
          </div>
        ),
      },
      { key: "default", header: "Padrão", render: getDefaultDisplay },
      {
        key: "flags",
        header: "Classificação",
        render: (item) => (
          <div className="flex flex-wrap gap-1">
            {item.is_benefit ? <StatusBadge label="Benefício" status="info" /> : null}
            {item.is_employer_charge ? <StatusBadge label="Encargo" status="warning" /> : null}
            {item.is_provision ? <StatusBadge label="Provisão" status="warning" /> : null}
            {item.is_variable_event ? <StatusBadge label="Evento" status="neutral" /> : null}
            {item.deducts_from_cost ? <StatusBadge label="Desconto" status="danger" /> : null}
          </div>
        ),
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
            <button
              type="button"
              onClick={async () => {
                setActionError(null);

                try {
                  if (item.is_active) {
                    await inactivateCostComponent(item.id);
                  } else {
                    await reactivateCostComponent(item.id);
                  }
                  await reload();
                } catch (toggleError) {
                  setActionError(toUserFriendlyErrorMessage(toggleError, "Não foi possível alterar o componente."));
                }
              }}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
              title={item.is_active ? "Inativar" : "Reativar"}
            >
              {item.is_active ? <Power className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            </button>
          </div>
        ),
      },
    ];

  function setField(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCategory(category?: CostComponentCategory) {
    setDrawerMode("category");
    setEditingCategory(category ?? null);
    setEditingComponent(null);
    setForm(
      category
        ? {
            name: category.name,
            key: category.key,
            description: category.description ?? "",
            sort_order: String(category.sort_order ?? 0),
            is_active: category.is_active,
          }
        : { sort_order: "0", is_active: true },
    );
    setFormError(null);
  }

  function openComponent(component?: CostComponent) {
    setDrawerMode("component");
    setEditingComponent(component ?? null);
    setEditingCategory(null);
    setForm(
      component
        ? {
            name: component.name,
            key: component.key,
            description: component.description ?? "",
            category_id: component.category_id,
            calculation_type: component.calculation_type,
            default_value: component.default_value !== null && component.default_value !== undefined ? String(component.default_value) : "",
            default_percentage:
              component.default_percentage !== null && component.default_percentage !== undefined
                ? String(component.default_percentage)
                : "",
            applies_to: component.applies_to,
            employment_type_id: component.employment_type_id ?? "",
            department_id: component.department_id ?? "",
            position_id: component.position_id ?? "",
            adds_to_company_cost: component.adds_to_company_cost,
            deducts_from_cost: component.deducts_from_cost,
            is_benefit: component.is_benefit,
            is_employer_charge: component.is_employer_charge,
            is_provision: component.is_provision,
            is_variable_event: component.is_variable_event,
            include_in_dashboard: component.include_in_dashboard,
            include_in_hour_cost: component.include_in_hour_cost,
            show_on_employee_profile: component.show_on_employee_profile,
            sort_order: String(component.sort_order ?? 0),
            is_active: component.is_active,
          }
        : {
            category_id: data?.categories[0]?.id ?? "",
            calculation_type: "fixed_monthly",
            applies_to: "manual",
            adds_to_company_cost: true,
            deducts_from_cost: false,
            is_benefit: false,
            is_employer_charge: false,
            is_provision: false,
            is_variable_event: false,
            include_in_dashboard: true,
            include_in_hour_cost: true,
            show_on_employee_profile: true,
            sort_order: "0",
            is_active: true,
          },
    );
    setFormError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      if (drawerMode === "category") {
        const payload = {
          name: String(form.name ?? ""),
          key: String(form.key ?? ""),
          description: String(form.description ?? ""),
          sort_order: Number(form.sort_order ?? 0),
          is_active: form.is_active !== false,
        };

        if (editingCategory) {
          await updateCostComponentCategory(editingCategory.id, payload);
        } else {
          await createCostComponentCategory(payload);
        }
      }

      if (drawerMode === "component") {
        const payload = {
          category_id: String(form.category_id ?? ""),
          name: String(form.name ?? ""),
          key: String(form.key ?? ""),
          description: String(form.description ?? ""),
          calculation_type: String(form.calculation_type ?? "fixed_monthly") as CostCalculationType,
          default_value: String(form.default_value ?? ""),
          default_percentage: String(form.default_percentage ?? ""),
          applies_to: String(form.applies_to ?? "manual") as CostAppliesTo,
          employment_type_id: String(form.employment_type_id ?? ""),
          department_id: String(form.department_id ?? ""),
          position_id: String(form.position_id ?? ""),
          adds_to_company_cost: form.adds_to_company_cost !== false,
          deducts_from_cost: Boolean(form.deducts_from_cost),
          is_benefit: Boolean(form.is_benefit),
          is_employer_charge: Boolean(form.is_employer_charge),
          is_provision: Boolean(form.is_provision),
          is_variable_event: Boolean(form.is_variable_event),
          include_in_dashboard: form.include_in_dashboard !== false,
          include_in_hour_cost: form.include_in_hour_cost !== false,
          show_on_employee_profile: form.show_on_employee_profile !== false,
          sort_order: Number(form.sort_order ?? 0),
          is_active: form.is_active !== false,
        };

        if (editingComponent) {
          await updateCostComponent(editingComponent.id, payload);
        } else {
          await createCostComponent(payload);
        }
      }

      setDrawerMode(null);
      await reload();
    } catch (submitError) {
      setFormError(toUserFriendlyErrorMessage(submitError, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {actionError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {data ? (
        <Tabs
          tabs={[
            {
              id: "components",
              label: "Componentes",
              content: (
                <SectionCard
                  title="Componentes de custo"
                  actions={
                    <button
                      type="button"
                      onClick={() => openComponent()}
                      className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
                    >
                      <Plus className="h-4 w-4" />
                      Novo componente
                    </button>
                  }
                >
                  <DataTable
                    data={data.components}
                    columns={componentColumns}
                    getRowKey={(item) => item.id}
                    emptyState={<EmptyState title="Nenhum componente cadastrado" />}
                  />
                </SectionCard>
              ),
            },
            {
              id: "categories",
              label: "Categorias",
              content: (
                <SectionCard
                  title="Categorias de custo"
                  actions={
                    <button
                      type="button"
                      onClick={() => openCategory()}
                      className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
                    >
                      <Plus className="h-4 w-4" />
                      Nova categoria
                    </button>
                  }
                >
                  <DataTable
                    data={data.categories}
                    columns={categoryColumns}
                    getRowKey={(item) => item.id}
                    emptyState={<EmptyState title="Nenhuma categoria cadastrada" />}
                  />
                </SectionCard>
              ),
            },
          ]}
        />
      ) : null}

      <DrawerForm
        open={drawerMode !== null}
        title={
          drawerMode === "category"
            ? editingCategory
              ? "Editar categoria"
              : "Nova categoria"
            : editingComponent
              ? "Editar componente"
              : "Novo componente"
        }
        description="Custos de mão de obra"
        onClose={() => setDrawerMode(null)}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Nome" required>
              <input
                className={fieldClassName}
                value={String(form.name ?? "")}
                onChange={(event) => setField("name", event.target.value)}
              />
            </FormField>
            <FormField label="Chave interna">
              <input
                className={fieldClassName}
                value={String(form.key ?? "")}
                onChange={(event) => setField("key", event.target.value)}
              />
            </FormField>
          </div>

          {drawerMode === "component" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Categoria" required>
                  <select
                    className={fieldClassName}
                    value={String(form.category_id ?? "")}
                    onChange={(event) => setField("category_id", event.target.value)}
                  >
                    {data?.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Tipo de cálculo">
                  <select
                    className={fieldClassName}
                    value={String(form.calculation_type ?? "fixed_monthly")}
                    onChange={(event) => setField("calculation_type", event.target.value)}
                  >
                    {Object.entries(calculationTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Valor padrão">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={fieldClassName}
                    value={String(form.default_value ?? "")}
                    onChange={(event) => setField("default_value", event.target.value)}
                  />
                </FormField>
                <FormField label="Percentual padrão">
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    className={fieldClassName}
                    value={String(form.default_percentage ?? "")}
                    onChange={(event) => setField("default_percentage", event.target.value)}
                  />
                </FormField>
                <FormField label="Incidência">
                  <select
                    className={fieldClassName}
                    value={String(form.applies_to ?? "manual")}
                    onChange={(event) => setField("applies_to", event.target.value)}
                  >
                    {Object.entries(appliesToLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Tipo de vínculo">
                  <select
                    className={fieldClassName}
                    value={String(form.employment_type_id ?? "")}
                    onChange={(event) => setField("employment_type_id", event.target.value)}
                  >
                    <option value="">Todos</option>
                    {data?.employmentTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Departamento">
                  <select
                    className={fieldClassName}
                    value={String(form.department_id ?? "")}
                    onChange={(event) => setField("department_id", event.target.value)}
                  >
                    <option value="">Todos</option>
                    {data?.departments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Cargo">
                  <select
                    className={fieldClassName}
                    value={String(form.position_id ?? "")}
                    onChange={(event) => setField("position_id", event.target.value)}
                  >
                    <option value="">Todos</option>
                    {data?.positions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-2">
                {[
                  ["adds_to_company_cost", "Soma no custo da empresa"],
                  ["deducts_from_cost", "Desconta do custo"],
                  ["is_benefit", "Benefício"],
                  ["is_employer_charge", "Encargo"],
                  ["is_provision", "Provisão"],
                  ["is_variable_event", "Evento mensal"],
                  ["include_in_dashboard", "Dashboard"],
                  ["include_in_hour_cost", "Custo por hora"],
                  ["show_on_employee_profile", "Perfil do colaborador"],
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
            </>
          ) : null}

          <FormField label="Descrição">
            <textarea
              className={`${fieldClassName} min-h-24`}
              value={String(form.description ?? "")}
              onChange={(event) => setField("description", event.target.value)}
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Ordem">
              <input
                type="number"
                min="0"
                className={fieldClassName}
                value={String(form.sort_order ?? "0")}
                onChange={(event) => setField("sort_order", event.target.value)}
              />
            </FormField>
            <label className="flex items-center gap-2 pt-7 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.is_active !== false}
                onChange={(event) => setField("is_active", event.target.checked)}
                className={checkboxClassName()}
              />
              Ativo
            </label>
          </div>

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
