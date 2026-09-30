"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";

import type { Permission, PermissionScope, Role, RolePermission } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

const scopes: Array<{ value: PermissionScope; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "own_department", label: "Setor" },
  { value: "subordinates", label: "Subordinados" },
  { value: "own_data", label: "Próprios dados" },
  { value: "none", label: "Nenhum" },
];

interface PermissionMatrixProps {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  canEdit?: boolean;
  onSave: (roleId: string, grants: Array<{ permission_id: string; scope: PermissionScope }>) => Promise<void>;
}

export function PermissionMatrix({
  roles,
  permissions,
  rolePermissions,
  canEdit = false,
  onSave,
}: PermissionMatrixProps) {
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, PermissionScope>>(() => {
    const entries = rolePermissions
      .filter((item) => item.role_id === roles[0]?.id)
      .map((item) => [item.permission_id, item.scope] as const);

    return Object.fromEntries(entries);
  });

  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      groups[permission.module] = [...(groups[permission.module] ?? []), permission];
      return groups;
    }, {});
  }, [permissions]);

  function selectRole(roleId: string) {
    setSelectedRoleId(roleId);
    setDraft(
      Object.fromEntries(
        rolePermissions
          .filter((item) => item.role_id === roleId)
          .map((item) => [item.permission_id, item.scope] as const),
      ),
    );
  }

  async function save() {
    if (!selectedRoleId || !canEdit) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const grants = Object.entries(draft)
        .filter(([, scope]) => scope !== "none")
        .map(([permission_id, scope]) => ({ permission_id, scope }));
      await onSave(selectedRoleId, grants);
    } catch (saveError) {
      setError(toUserFriendlyErrorMessage(saveError, "Não foi possível salvar a matriz de permissões."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => selectRole(role.id)}
            className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
              selectedRoleId === role.id
                ? "bg-[#111316] text-white"
                : "text-zinc-700 hover:bg-white hover:text-zinc-950"
            }`}
          >
            {role.name}
          </button>
        ))}
      </div>

      <div className="min-w-0 rounded-md border border-zinc-200">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-950">
              {selectedRole?.name ?? "Perfil"}
            </h3>
            <p className="text-xs text-zinc-500">Permissões por módulo, ação e escopo.</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || selectedRole?.key === "master" || !canEdit}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#f97316] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving
              ? "Salvando..."
              : !canEdit
                ? "Somente Master"
                : selectedRole?.key === "master"
                  ? "Master protegido"
                  : "Salvar matriz"}
          </button>
        </div>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="divide-y divide-zinc-100">
          {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
            <div key={module} className="p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#f97316]">
                {module}
              </h4>
              <div className="grid gap-3">
                {modulePermissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="grid gap-2 rounded-md border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_190px]"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{permission.key}</p>
                      <p className="text-xs text-zinc-500">{permission.description}</p>
                    </div>
                    <select
                      value={draft[permission.id] ?? "none"}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [permission.id]: event.target.value as PermissionScope,
                        }))
                      }
                      disabled={selectedRole?.key === "master" || !canEdit}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                    >
                      {scopes.map((scope) => (
                        <option key={scope.value} value={scope.value}>
                          {scope.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
