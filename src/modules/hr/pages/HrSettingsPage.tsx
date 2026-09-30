"use client";

import { AlertTriangle, Edit2, Plus, Power, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { AuditTimeline } from "@/modules/hr/components/AuditTimeline";
import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { LaborCostSettingsPanel } from "@/modules/hr/components/LaborCostSettingsPanel";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { PermissionMatrix } from "@/modules/hr/components/PermissionMatrix";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { SystemUsersPanel } from "@/modules/hr/components/SystemUsersPanel";
import { Tabs } from "@/modules/hr/components/Tabs";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import { listAuditLogs } from "@/modules/hr/services/audit.service";
import { getCurrentUserAccess, hasMasterRole } from "@/modules/hr/services/auth.service";
import {
  createSettingItem,
  inactivateSettingItem,
  listSettingItems,
  reactivateSettingItem,
  settingEntityLabels,
  updateSettingItem,
  type HrSettingEntity,
} from "@/modules/hr/services/settings.service";
import {
  listPermissions,
  listRolePermissions,
  listRoles,
  listSystemUsers,
  type SystemUser,
  updateRolePermissions,
} from "@/modules/hr/services/permissions.service";
import type {
  AuditLog,
  LookupRecord,
  Permission,
  PermissionScope,
  Role,
  RolePermission,
} from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import {
  isDailyReportOccurrenceType,
  isNonDayImpactingOccurrenceType,
} from "@/modules/hr/utils/occurrences";

const settingGroups: Array<{ title: string; entities: HrSettingEntity[] }> = [
  {
    title: "Empresa",
    entities: ["company_units", "departments", "cost_centers"],
  },
  {
    title: "Cadastros do RH",
    entities: [
      "positions",
      "employment_types",
      "marital_statuses",
      "dependent_relationship_types",
      "employee_statuses",
      "termination_reasons",
      "employee_movement_cost_categories",
      "document_types",
      "leave_types",
      "occurrence_categories",
      "occurrence_types",
      "trainings",
    ],
  },
  {
    title: "Campos e alertas",
    entities: ["custom_fields", "alert_rules"],
  },
  {
    title: "Segurança",
    entities: ["roles"],
  },
];

interface SettingsPageData {
  items: LookupRecord[];
  roles: Role[];
  systemUsers: SystemUser[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  auditLogs: AuditLog[];
  loadWarnings: string[];
  isMaster: boolean;
  currentProfileId: string | null;
}

async function loadOptionalSettingsData<T>(label: string, loader: Promise<T>, fallback: T) {
  try {
    return {
      data: await loader,
      warning: null,
    };
  } catch (loadError) {
    return {
      data: fallback,
      warning: toUserFriendlyErrorMessage(loadError, `Não foi possível carregar ${label}.`),
    };
  }
}

async function loadSettingsPageData(entity: HrSettingEntity): Promise<SettingsPageData> {
  let items: LookupRecord[];
  let currentUserAccess: Awaited<ReturnType<typeof getCurrentUserAccess>>;

  try {
    [items, currentUserAccess] = await Promise.all([
      listSettingItems(entity),
      getCurrentUserAccess(),
    ]);
  } catch (loadError) {
    throw new Error(
      toUserFriendlyErrorMessage(loadError, `Não foi possível carregar ${settingEntityLabels[entity]}.`),
    );
  }

  const [roles, systemUsers, permissions, rolePermissions, auditLogs] = await Promise.all([
    loadOptionalSettingsData<Role[]>("os perfis de acesso", listRoles(), []),
    loadOptionalSettingsData<SystemUser[]>("os usuários do sistema", listSystemUsers(), []),
    loadOptionalSettingsData<Permission[]>("as permissões", listPermissions(), []),
    loadOptionalSettingsData<RolePermission[]>("a matriz de permissões", listRolePermissions(), []),
    loadOptionalSettingsData<AuditLog[]>("a auditoria", listAuditLogs(80), []),
  ]);

  return {
    items,
    roles: roles.data,
    systemUsers: systemUsers.data,
    permissions: permissions.data,
    rolePermissions: rolePermissions.data,
    auditLogs: auditLogs.data,
    loadWarnings: [
      roles.warning,
      systemUsers.warning,
      permissions.warning,
      rolePermissions.warning,
      auditLogs.warning,
    ].filter(Boolean) as string[],
    isMaster: hasMasterRole(currentUserAccess),
    currentProfileId: currentUserAccess?.profile?.id ?? null,
  };
}

function getDisplayName(item: LookupRecord) {
  return (item as LookupRecord & { label?: string }).label ?? item.name;
}

function getStringFormValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getOccurrenceTypeFormClassification(values: Record<string, unknown>) {
  return {
    key: getStringFormValue(values.key),
    name: getStringFormValue(values.name),
    include_in_daily_report: Boolean(values.include_in_daily_report),
    counts_as_absence: Boolean(values.counts_as_absence),
    counts_as_medical_certificate: Boolean(values.counts_as_medical_certificate),
  };
}

export function HrSettingsPage() {
  const [selectedEntity, setSelectedEntity] = useState<HrSettingEntity>("departments");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LookupRecord | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const entityKey = selectedEntity;
  const { data, loading, error, reload } = useAsyncResource(
    () => loadSettingsPageData(selectedEntity),
    entityKey,
  );
  const occurrenceTypeForm = getOccurrenceTypeFormClassification(form);
  const locksOccurrenceDayImpact =
    selectedEntity === "occurrence_types" && isNonDayImpactingOccurrenceType(occurrenceTypeForm);

  const columns = useMemo<Array<DataTableColumn<LookupRecord>>>(
    () => [
      {
        key: "name",
        header: "Nome",
        render: (item) => (
          <div>
            <p className="font-medium text-zinc-950">{getDisplayName(item)}</p>
            <p className="font-mono text-xs text-zinc-500">{item.key}</p>
          </div>
        ),
      },
      {
        key: "extra",
        header: "Detalhe",
        render: (item) => {
          const extra = item as LookupRecord & {
            entity?: string;
            field_type?: string;
            severity?: string;
            validity_months?: number | null;
            is_required?: boolean;
            include_in_daily_report?: boolean;
            counts_as_absence?: boolean;
            counts_as_medical_certificate?: boolean;
            priority_order?: number | null;
            is_child?: boolean;
            is_spouse?: boolean;
            is_parent?: boolean;
            is_punishment?: boolean;
            punishment_level?: string | null;
            movement_type?: string | null;
          };

          if (selectedEntity === "custom_fields") {
            return `${extra.entity ?? "-"} / ${extra.field_type ?? "-"}`;
          }

          if (selectedEntity === "alert_rules") {
            return extra.severity ?? "-";
          }

          if (selectedEntity === "trainings") {
            return `${extra.validity_months ? `${extra.validity_months} meses` : "Sem validade"} / ${
              extra.is_required ? "Obrigatório" : "Opcional"
            }`;
          }

          if (selectedEntity === "occurrence_types") {
            const punishment = extra.is_punishment ? " / Punicao" : "";
            const dailyReport = isDailyReportOccurrenceType({
              key: item.key,
              name: getDisplayName(item),
              include_in_daily_report: extra.include_in_daily_report,
              counts_as_absence: extra.counts_as_absence,
              counts_as_medical_certificate: extra.counts_as_medical_certificate,
            });

            return dailyReport
              ? `Relatório diário / Prioridade ${extra.priority_order ?? 99}${punishment}`
              : `Fora do relatório diário${punishment}`;
          }

          if (selectedEntity === "dependent_relationship_types") {
            return [
              extra.is_child ? "Filho(a)" : null,
              extra.is_spouse ? "Conjuge" : null,
              extra.is_parent ? "Ascendente" : null,
            ].filter(Boolean).join(" / ") || item.description || "-";
          }

          if (selectedEntity === "employee_movement_cost_categories") {
            const labels: Record<string, string> = {
              admission: "Admissão",
              termination: "Desligamento",
              both: "Admissão e desligamento",
            };

            return labels[extra.movement_type ?? "both"] ?? item.description ?? "-";
          }

          return item.description ?? "-";
        },
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
              onClick={() => openEdit(item)}
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
                    await inactivateSettingItem(selectedEntity, item.id);
                  } else {
                    await reactivateSettingItem(selectedEntity, item.id);
                  }
                  await reload();
                } catch (toggleError) {
                  setActionError(
                    toUserFriendlyErrorMessage(toggleError, "Não foi possível alterar este cadastro."),
                  );
                }
              }}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-orange-200 hover:text-[#f97316]"
              title={item.is_active ? "Inativar" : "Reativar"}
            >
              {item.is_active ? <Power className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            </button>
          </div>
        ),
      },
    ],
    [reload, selectedEntity],
  );

  function setField(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingItem(null);
    setForm(
      selectedEntity === "custom_fields"
        ? { entity: "employee", field_type: "text", is_required: false }
        : selectedEntity === "alert_rules"
          ? { severity: "warning", entity: "employee_document", event: "expiration_date" }
          : selectedEntity === "occurrence_types"
            ? {
                include_in_daily_report: false,
                counts_as_absence: false,
                counts_as_medical_certificate: false,
                is_punishment: false,
                priority_order: "99",
              }
            : selectedEntity === "dependent_relationship_types"
              ? { is_child: false, is_spouse: false, is_parent: false }
              : selectedEntity === "employee_movement_cost_categories"
                ? { movement_type: "both" }
            : {},
    );
    setDrawerOpen(true);
  }

  function openEdit(item: LookupRecord) {
    const extra = item as LookupRecord & {
      label?: string;
      entity?: string;
      field_type?: string;
      is_required?: boolean;
      requires_expiration_date?: boolean;
      default_validity_months?: number | null;
      validity_months?: number | null;
      severity?: string;
      event?: string;
      days_before?: number | null;
      include_in_daily_report?: boolean;
      counts_as_absence?: boolean;
      counts_as_medical_certificate?: boolean;
      is_punishment?: boolean;
      punishment_level?: string | null;
      movement_type?: string | null;
      is_child?: boolean;
      is_spouse?: boolean;
      is_parent?: boolean;
      priority_order?: number | null;
    };

    setEditingItem(item);
    setForm({
      name: getDisplayName(item),
      key: item.key,
      description: item.description ?? "",
      is_active: item.is_active,
      entity: extra.entity ?? "employee",
      field_type: extra.field_type ?? "text",
      is_required: extra.is_required ?? false,
      requires_expiration_date: extra.requires_expiration_date ?? false,
      default_validity_months: extra.default_validity_months ? String(extra.default_validity_months) : "",
      validity_months: extra.validity_months ? String(extra.validity_months) : "",
      severity: extra.severity ?? "warning",
      event: extra.event ?? "expiration_date",
      days_before: extra.days_before ? String(extra.days_before) : "",
      include_in_daily_report: extra.include_in_daily_report ?? false,
      counts_as_absence: extra.counts_as_absence ?? false,
      counts_as_medical_certificate: extra.counts_as_medical_certificate ?? false,
      is_punishment: extra.is_punishment ?? false,
      punishment_level: extra.punishment_level ?? "",
      movement_type: extra.movement_type ?? "both",
      is_child: extra.is_child ?? false,
      is_spouse: extra.is_spouse ?? false,
      is_parent: extra.is_parent ?? false,
      priority_order: extra.priority_order ? String(extra.priority_order) : "99",
    });
    setDrawerOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const payload: Record<string, string | number | boolean | null | undefined> = {
        ...form,
        label: selectedEntity === "custom_fields" ? String(form.name ?? "") : undefined,
        default_validity_months: form.default_validity_months
          ? Number(form.default_validity_months)
          : undefined,
        validity_months: form.validity_months ? Number(form.validity_months) : undefined,
        days_before: form.days_before ? Number(form.days_before) : undefined,
        priority_order:
          selectedEntity === "occurrence_types" && form.priority_order
            ? Number(form.priority_order)
            : undefined,
      };

      if (
        selectedEntity === "occurrence_types" &&
        isNonDayImpactingOccurrenceType(getOccurrenceTypeFormClassification(payload))
      ) {
        payload.include_in_daily_report = false;
        payload.counts_as_absence = false;
        payload.counts_as_medical_certificate = false;
      }

      if (editingItem) {
        await updateSettingItem(selectedEntity, editingItem.id, payload);
      } else {
        await createSettingItem(selectedEntity, payload);
      }

      setDrawerOpen(false);
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
        eyebrow="Governança"
        title="Configurações do RH"
        description="Cadastros configuráveis, segurança, acessos, campos personalizados, alertas e auditoria."
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {actionError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}
      {data?.loadWarnings.length ? (
        <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
            <div>
              <p className="font-semibold">Algumas informações secundárias não foram carregadas.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.loadWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {data ? (
        <Tabs
          tabs={[
            {
              id: "settings",
              label: "Cadastros",
              content: (
                <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
                  <SectionCard title="Áreas de configuração">
                    <div className="space-y-5">
                      {settingGroups.map((group) => (
                        <div key={group.title}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            {group.title}
                          </p>
                          <div className="space-y-1">
                            {group.entities.map((entity) => (
                              <button
                                key={entity}
                                type="button"
                                onClick={() => setSelectedEntity(entity)}
                                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                                  selectedEntity === entity
                                    ? "bg-[#111316] text-white"
                                    : "text-zinc-700 hover:bg-orange-50 hover:text-[#f97316]"
                                }`}
                              >
                                {settingEntityLabels[entity]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <div className="space-y-5">
                    {selectedEntity === "roles" ? (
                      <>
                        <SystemUsersPanel
                          users={data.systemUsers}
                          roles={data.roles}
                          canRejectAccessRequests={data.isMaster}
                          canDeleteUsers={data.isMaster}
                          currentProfileId={data.currentProfileId}
                          onChanged={reload}
                        />

                        {data.roles.length === 0 ? (
                          <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                            <div className="flex gap-3">
                              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                              <div>
                                <p className="font-semibold">Nenhum perfil de acesso retornou do Supabase.</p>
                                <p className="mt-1">
                                  Isso costuma indicar que o seed inicial não foi aplicado, ou que o usuário logado
                                  ainda não possui um `profile` com papel Master/RH vinculado em `user_roles`.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    <SectionCard
                      title={settingEntityLabels[selectedEntity]}
                      description="Registros históricos devem ser inativados em vez de excluídos."
                      actions={
                        <button
                          type="button"
                          onClick={openCreate}
                          className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
                        >
                          <Plus className="h-4 w-4" />
                          Novo
                        </button>
                      }
                    >
                      <DataTable
                        data={data.items}
                        columns={columns}
                        getRowKey={(item) => item.id}
                        emptyState={<EmptyState title="Nenhum registro encontrado" />}
                      />
                    </SectionCard>
                  </div>
                </div>
              ),
            },
            {
              id: "labor-costs",
              label: "Custos de mão de obra",
              content: <LaborCostSettingsPanel />,
            },
            {
              id: "security",
              label: "Segurança e acessos",
              content: (
                <div className="space-y-6">
                  <SystemUsersPanel
                    users={data.systemUsers}
                    roles={data.roles}
                    canRejectAccessRequests={data.isMaster}
                    canDeleteUsers={data.isMaster}
                    currentProfileId={data.currentProfileId}
                    onChanged={reload}
                  />

                  <SectionCard
                    title="Matriz de permissões"
                    description="Perfis recebem permissões por módulo, ação e escopo. O perfil Master permanece protegido."
                  >
                    <PermissionMatrix
                      roles={data.roles}
                      permissions={data.permissions}
                      rolePermissions={data.rolePermissions}
                      canEdit={data.isMaster}
                      onSave={async (
                        roleId: string,
                        grants: Array<{ permission_id: string; scope: PermissionScope }>,
                      ) => {
                        await updateRolePermissions(roleId, grants);
                        await reload();
                      }}
                    />
                  </SectionCard>
                </div>
              ),
            },
            {
              id: "audit",
              label: "Auditoria",
              content: (
                <SectionCard title="Auditoria recente" description="Eventos relevantes registrados no módulo.">
                  <AuditTimeline items={data.auditLogs} type="audit" />
                </SectionCard>
              ),
            },
          ]}
        />
      ) : null}

      <DrawerForm
        open={drawerOpen}
        title={editingItem ? "Editar configuração" : "Nova configuração"}
        description={settingEntityLabels[selectedEntity]}
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <FormField label={selectedEntity === "custom_fields" ? "Rotulo" : "Nome"} required>
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

          {selectedEntity === "custom_fields" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Entidade">
                <select
                  className={fieldClassName}
                  value={String(form.entity ?? "employee")}
                  onChange={(event) => setField("entity", event.target.value)}
                >
                  <option value="employee">Colaborador</option>
                  <option value="document">Documento</option>
                  <option value="occurrence">Ocorrência</option>
                  <option value="training">Treinamento</option>
                </select>
              </FormField>
              <FormField label="Tipo do campo">
                <select
                  className={fieldClassName}
                  value={String(form.field_type ?? "text")}
                  onChange={(event) => setField("field_type", event.target.value)}
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                  <option value="boolean">Booleano</option>
                  <option value="select">Lista</option>
                  <option value="multi_select">Multipla escolha</option>
                  <option value="file">Arquivo</option>
                </select>
              </FormField>
            </div>
          ) : null}

          {selectedEntity === "document_types" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.requires_expiration_date)}
                  onChange={(event) => setField("requires_expiration_date", event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                />
                Exige validade
              </label>
              <FormField label="Validade padrao em meses">
                <input
                  type="number"
                  min="1"
                  className={fieldClassName}
                  value={String(form.default_validity_months ?? "")}
                  onChange={(event) => setField("default_validity_months", event.target.value)}
                />
              </FormField>
            </div>
          ) : null}

          {selectedEntity === "trainings" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_required)}
                  onChange={(event) => setField("is_required", event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                />
                Obrigatório
              </label>
              <FormField label="Validade em meses">
                <input
                  type="number"
                  min="1"
                  className={fieldClassName}
                  value={String(form.validity_months ?? "")}
                  onChange={(event) => setField("validity_months", event.target.value)}
                />
              </FormField>
            </div>
          ) : null}

          {selectedEntity === "employee_movement_cost_categories" ? (
            <FormField label="Aplicar em">
              <select
                className={fieldClassName}
                value={String(form.movement_type ?? "both")}
                onChange={(event) => setField("movement_type", event.target.value)}
              >
                <option value="both">Admissão e desligamento</option>
                <option value="admission">Somente admissão</option>
                <option value="termination">Somente desligamento</option>
              </select>
            </FormField>
          ) : null}

          {selectedEntity === "occurrence_types" ? (
            <div className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.include_in_daily_report) && !locksOccurrenceDayImpact}
                    disabled={locksOccurrenceDayImpact}
                    onChange={(event) => setField("include_in_daily_report", event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                  />
                  Entra no relatório diário
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.counts_as_absence) && !locksOccurrenceDayImpact}
                    disabled={locksOccurrenceDayImpact}
                    onChange={(event) => setField("counts_as_absence", event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                  />
                  Conta como ausência
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.counts_as_medical_certificate) && !locksOccurrenceDayImpact}
                    disabled={locksOccurrenceDayImpact}
                    onChange={(event) => setField("counts_as_medical_certificate", event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                  />
                  Conta como atestado
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_punishment)}
                    onChange={(event) => setField("is_punishment", event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                  />
                  E uma punicao
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Prioridade no relatório">
                  <input
                    type="number"
                    min="1"
                    className={fieldClassName}
                    value={String(form.priority_order ?? "99")}
                    onChange={(event) => setField("priority_order", event.target.value)}
                  />
                </FormField>
                <FormField label="Nivel da punicao">
                  <input
                    className={fieldClassName}
                    value={String(form.punishment_level ?? "")}
                    placeholder="advertencia, suspensao..."
                    onChange={(event) => setField("punishment_level", event.target.value)}
                  />
                </FormField>
              </div>
            </div>
          ) : null}

          {selectedEntity === "dependent_relationship_types" ? (
            <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_child)}
                  onChange={(event) => setField("is_child", event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                />
                Filho(a)
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_spouse)}
                  onChange={(event) => setField("is_spouse", event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                />
                Conjuge
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_parent)}
                  onChange={(event) => setField("is_parent", event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
                />
                Pai/mae
              </label>
            </div>
          ) : null}

          {selectedEntity === "alert_rules" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Entidade">
                <input
                  className={fieldClassName}
                  value={String(form.entity ?? "")}
                  onChange={(event) => setField("entity", event.target.value)}
                />
              </FormField>
              <FormField label="Evento">
                <input
                  className={fieldClassName}
                  value={String(form.event ?? "")}
                  onChange={(event) => setField("event", event.target.value)}
                />
              </FormField>
              <FormField label="Dias antes">
                <input
                  type="number"
                  min="0"
                  className={fieldClassName}
                  value={String(form.days_before ?? "")}
                  onChange={(event) => setField("days_before", event.target.value)}
                />
              </FormField>
              <FormField label="Severidade">
                <select
                  className={fieldClassName}
                  value={String(form.severity ?? "warning")}
                  onChange={(event) => setField("severity", event.target.value)}
                >
                  <option value="info">Info</option>
                  <option value="warning">Aviso</option>
                  <option value="critical">Crítico</option>
                </select>
              </FormField>
            </div>
          ) : null}

          <FormField label="Descrição">
            <textarea
              className={`${fieldClassName} min-h-24`}
              value={String(form.description ?? "")}
              onChange={(event) => setField("description", event.target.value)}
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.is_active !== false}
              onChange={(event) => setField("is_active", event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
            />
            Ativo
          </label>

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-5">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
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
