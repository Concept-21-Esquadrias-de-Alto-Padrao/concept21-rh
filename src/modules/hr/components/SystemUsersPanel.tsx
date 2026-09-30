"use client";

import { AlertTriangle, Power, RotateCcw, ShieldPlus, UserPlus, UserX } from "lucide-react";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import {
  assignUserRole,
  createSystemProfile,
  deleteSystemUser,
  isSystemUserPendingAccess,
  rejectAccessRequest,
  setProfileActive,
  setUserRoleActive,
  type SystemUser,
} from "@/modules/hr/services/permissions.service";
import type { Role } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

interface SystemUsersPanelProps {
  users: SystemUser[];
  roles: Role[];
  canRejectAccessRequests?: boolean;
  canDeleteUsers?: boolean;
  currentProfileId?: string | null;
  onChanged: () => Promise<void>;
}

export function SystemUsersPanel({
  users,
  roles,
  canRejectAccessRequests = false,
  canDeleteUsers = false,
  currentProfileId = null,
  onChanged,
}: SystemUsersPanelProps) {
  const [drawer, setDrawer] = useState<"profile" | "role" | null>(null);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingUsers = users.filter(isSystemUserPendingAccess);

  const columns: Array<DataTableColumn<SystemUser>> = [
    {
      key: "user",
      header: "Usuário",
      render: (user) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-zinc-950">{user.full_name}</p>
            {isSystemUserPendingAccess(user) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                <AlertTriangle className="h-3 w-3" />
                Pendente
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">{user.email}</p>
          <p className="font-mono text-[11px] text-zinc-400">
            {user.auth_user_id ? `Auth: ${user.auth_user_id}` : "Sem auth_user_id vinculado"}
          </p>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Perfis",
      render: (user) => (
        <div className="flex flex-wrap gap-2">
          {user.user_roles?.length ? (
            user.user_roles.map((userRole) => (
              <button
                key={userRole.id}
                type="button"
                onClick={() => toggleUserRole(userRole.id, !userRole.is_active)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-[#f97316] hover:text-[#f97316]"
                title={userRole.is_active ? "Inativar perfil deste usuário" : "Reativar perfil deste usuário"}
              >
                {userRole.role?.name ?? "Perfil"} {userRole.is_active ? "" : "(inativo)"}
              </button>
            ))
          ) : (
            <span className="text-xs text-zinc-500">
              {isSystemUserPendingAccess(user) ? "Aguardando perfil de acesso" : "Nenhum perfil vinculado"}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <StatusBadge
          label={isSystemUserPendingAccess(user) ? "Pendente" : user.is_active ? "Ativo" : "Inativo"}
          status={isSystemUserPendingAccess(user) ? "pending" : user.is_active ? "ativo" : "inativo"}
        />
      ),
    },
    {
      key: "actions",
      header: "Ações",
      render: (user) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedUser(user);
              setForm({});
              setDrawer("role");
            }}
            className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-[#f97316] hover:text-[#f97316]"
            title="Vincular perfil"
          >
            <ShieldPlus className="h-4 w-4" />
          </button>
          {canDeleteUsers && user.id !== currentProfileId ? (
            <button
              type="button"
              onClick={() => deleteUser(user)}
              className="grid h-9 w-9 place-items-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
              title={isSystemUserPendingAccess(user) ? "Recusar e excluir cadastro" : "Excluir cadastro"}
            >
              <UserX className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => toggleProfile(user.id, !user.is_active)}
            className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:border-orange-200 hover:text-[#f97316]"
            title={user.is_active ? "Inativar usuário" : "Reativar usuário"}
          >
            {user.is_active ? <Power className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
          </button>
        </div>
      ),
    },
  ];

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function toggleUserRole(userRoleId: string, isActive: boolean) {
    setError(null);

    try {
      await setUserRoleActive(userRoleId, isActive);
      await onChanged();
    } catch (toggleError) {
      setError(toUserFriendlyErrorMessage(toggleError, "Não foi possível alterar o perfil de acesso."));
    }
  }

  async function toggleProfile(profileId: string, isActive: boolean) {
    setError(null);

    try {
      await setProfileActive(profileId, isActive);
      await onChanged();
    } catch (toggleError) {
      setError(toUserFriendlyErrorMessage(toggleError, "Não foi possível alterar o usuário."));
    }
  }

  async function deleteUser(user: SystemUser) {
    const pending = isSystemUserPendingAccess(user);
    const confirmed = window.confirm(
      pending
        ? `Recusar e excluir o cadastro de ${user.full_name}? Esta ação remove o usuário do Auth e apaga o profile vinculado.`
        : `Excluir definitivamente o cadastro de ${user.full_name}? Esta ação remove o usuário do Auth e apaga o profile vinculado.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      if (pending && canRejectAccessRequests) {
        await rejectAccessRequest(user.id);
      } else {
        await deleteSystemUser(user.id);
      }

      await onChanged();
    } catch (deleteError) {
      setError(toUserFriendlyErrorMessage(deleteError, "Não foi possível excluir o cadastro."));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (drawer === "profile") {
        if (!form.full_name || !form.email) {
          throw new Error("Nome e e-mail são obrigatórios.");
        }

        await createSystemProfile({
          auth_user_id: form.auth_user_id,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
        });
      }

      if (drawer === "role") {
        if (!selectedUser || !form.role_id) {
          throw new Error("Selecione um perfil de acesso.");
        }

        await assignUserRole(selectedUser.id, form.role_id);
      }

      setDrawer(null);
      setSelectedUser(null);
      setForm({});
      await onChanged();
    } catch (submitError) {
      setError(toUserFriendlyErrorMessage(submitError, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionCard
        title="Usuários do sistema"
        description="Usuarios confirmados sem perfil ficam pendentes ate o Master/Admin vincular um perfil de acesso ou recusar o cadastro."
        actions={
          <button
            type="button"
            onClick={() => {
              setSelectedUser(null);
              setForm({});
              setDrawer("profile");
            }}
            className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
          >
            <UserPlus className="h-4 w-4" />
            Novo perfil de usuário
          </button>
        }
      >
        {error && drawer === null ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {pendingUsers.length ? (
          <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
              <div>
                <p className="font-semibold">
                  {pendingUsers.length} cadastro(s) aguardando perfil de acesso.
                </p>
                <p className="mt-1">
                  Vincule um perfil para liberar acesso ou recuse para excluir o cadastro.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <DataTable
          data={users}
          columns={columns}
          getRowKey={(user) => user.id}
          emptyState={
            <EmptyState
              title="Nenhum usuário encontrado"
              description="Crie um registro em profiles ou verifique se o usuário logado tem permissão hr.security.users.view."
            />
          }
        />
      </SectionCard>

      <DrawerForm
        open={drawer !== null}
        title={drawer === "profile" ? "Novo perfil de usuário" : "Vincular perfil de acesso"}
        description={
          drawer === "profile"
            ? "Crie o profile público depois de criar o usuário em Supabase Auth."
            : selectedUser?.full_name
        }
        onClose={() => setDrawer(null)}
      >
        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {drawer === "profile" ? (
            <>
              <FormField label="Auth user ID" hint="Copie o ID em Supabase Authentication > Users.">
                <input
                  className={fieldClassName}
                  value={form.auth_user_id ?? ""}
                  onChange={(event) => setField("auth_user_id", event.target.value)}
                />
              </FormField>
              <FormField label="Nome completo" required>
                <input
                  className={fieldClassName}
                  value={form.full_name ?? ""}
                  onChange={(event) => setField("full_name", event.target.value)}
                />
              </FormField>
              <FormField label="E-mail" required>
                <input
                  type="email"
                  className={fieldClassName}
                  value={form.email ?? ""}
                  onChange={(event) => setField("email", event.target.value)}
                />
              </FormField>
              <FormField label="Telefone">
                <input
                  className={fieldClassName}
                  value={form.phone ?? ""}
                  onChange={(event) => setField("phone", event.target.value)}
                />
              </FormField>
            </>
          ) : (
            <FormField label="Perfil de acesso" required>
              <select
                className={fieldClassName}
                value={form.role_id ?? ""}
                onChange={(event) => setField("role_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-5">
            <button
              type="button"
              onClick={() => setDrawer(null)}
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
    </>
  );
}
