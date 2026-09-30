import { ensureCurrentUserIsMaster, getCurrentUserAccess, hasMasterRole } from "@/modules/hr/services/auth.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type {
  ID,
  AccessReviewRequest,
  Permission,
  PermissionScope,
  Profile,
  Role,
  RolePermission,
  UserRole,
} from "@/modules/hr/types";

export interface SystemUser extends Profile {
  user_roles: Array<
    UserRole & {
      role: Role | null;
    }
  >;
  access_review_requests?: AccessReviewRequest | AccessReviewRequest[] | null;
}

export async function listRoles() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Role[];
}

export async function listPermissions() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("*")
    .order("module", { ascending: true })
    .order("action", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Permission[];
}

export async function listRolePermissions(roleId?: ID) {
  const supabase = getHrSupabaseClient();
  let query = supabase.from("role_permissions").select("*");

  if (roleId) {
    query = query.eq("role_id", roleId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RolePermission[];
}

export async function listSystemUsers() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      *,
      user_roles(
        *,
        role:roles(*)
      ),
      access_review_requests(*)
      `,
    )
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as SystemUser[]).sort((left, right) => {
    const leftPending = isSystemUserPendingAccess(left) ? 0 : 1;
    const rightPending = isSystemUserPendingAccess(right) ? 0 : 1;

    if (leftPending !== rightPending) {
      return leftPending - rightPending;
    }

    return left.full_name.localeCompare(right.full_name, "pt-BR");
  });
}

export function isSystemUserPendingAccess(user: SystemUser) {
  const hasActiveRole = user.user_roles?.some((userRole) => userRole.is_active && userRole.role?.is_active);
  const accessRequests = Array.isArray(user.access_review_requests)
    ? user.access_review_requests
    : user.access_review_requests
      ? [user.access_review_requests]
      : [];
  const pendingRequest = accessRequests.some((request) => request.status === "pending");

  return Boolean(user.is_active && user.auth_user_id && !hasActiveRole && pendingRequest);
}

export async function createSystemProfile(input: {
  auth_user_id?: ID;
  full_name: string;
  email: string;
  phone?: string;
}) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: input.auth_user_id || null,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone || null,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile;
}

export async function setProfileActive(profileId: ID, isActive: boolean) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Não foi possível alterar este usuário. Verifique suas permissões de segurança.");
  }

  return data as Profile;
}

export async function assignUserRole(profileId: ID, roleId: ID) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("user_roles")
    .upsert(
      {
        profile_id: profileId,
        role_id: roleId,
        is_active: true,
      },
      { onConflict: "profile_id,role_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as UserRole;
}

export async function setUserRoleActive(userRoleId: ID, isActive: boolean) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("user_roles")
    .update({ is_active: isActive })
    .eq("id", userRoleId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Não foi possível alterar este perfil. Verifique suas permissões de segurança.");
  }

  return data as UserRole;
}

async function deleteSystemUserRequest(profileId: ID, fallbackMessage: string) {
  const response = await fetch("/api/hr/access-requests/reject", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId }),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? fallbackMessage);
  }
}

export async function rejectAccessRequest(profileId: ID) {
  await deleteSystemUserRequest(profileId, "Não foi possível recusar este cadastro.");
}

export async function deleteSystemUser(profileId: ID) {
  await deleteSystemUserRequest(profileId, "Não foi possível excluir este cadastro.");
}

export async function updateRolePermissions(
  roleId: ID,
  grants: Array<{ permission_id: ID; scope: PermissionScope }>,
) {
  await ensureCurrentUserIsMaster();

  const supabase = getHrSupabaseClient();

  const { error: deleteError } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (grants.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("role_permissions")
    .insert(grants.map((grant) => ({ ...grant, role_id: roleId })))
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RolePermission[];
}

export async function checkUserPermission(permissionKey: string) {
  const supabase = getHrSupabaseClient();

  try {
    const access = await getCurrentUserAccess();

    if (hasMasterRole(access)) {
      return true;
    }
  } catch {
    // Se a leitura do perfil falhar, a RPC continua sendo a fonte final da permissão.
  }

  const { data, error } = await supabase.rpc("has_permission", {
    permission_key: permissionKey,
  });

  if (error) {
    console.warn(`Não foi possível validar a permissão ${permissionKey}.`, error);
    return false;
  }

  return Boolean(data);
}
