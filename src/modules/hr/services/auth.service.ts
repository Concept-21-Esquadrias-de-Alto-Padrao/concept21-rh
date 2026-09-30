import { createClient, type User } from "@supabase/supabase-js";

import { assertSupabasePublicConfig, getPublicAppOrigin } from "@/lib/supabase/config";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type { Profile, Role, UserRole } from "@/modules/hr/types";

export interface CurrentUserAccess {
  authUserId: string;
  email: string | null;
  emailConfirmed: boolean;
  profile: (Profile & {
    user_roles?: Array<
      UserRole & {
        role: Role | null;
      }
    >;
  }) | null;
  roles: Role[];
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

type SupabaseUserWithConfirmedAt = User & {
  confirmed_at?: string | null;
};

export function isAuthUserEmailConfirmed(user?: User | null) {
  if (!user) {
    return false;
  }

  const confirmedAt = user.email_confirmed_at ?? (user as SupabaseUserWithConfirmedAt).confirmed_at;
  return Boolean(confirmedAt);
}

function getSignupEmailRedirectTo() {
  const callbackUrl = new URL("/auth/callback", getPublicAppOrigin());
  callbackUrl.searchParams.set("next", "/login?confirmed=1");
  return callbackUrl.toString();
}

function getSignupSupabaseClient() {
  const config = assertSupabasePublicConfig();

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
      persistSession: false,
    },
  });
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  if (!isAuthUserEmailConfirmed(data.user)) {
    await supabase.auth.signOut();
    throw new Error("Confirme seu e-mail antes de acessar a plataforma.");
  }

  return data;
}

export async function signUpWithEmail(input: SignUpInput) {
  const supabase = getSignupSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: getSignupEmailRedirectTo(),
      data: {
        full_name: input.fullName,
        phone: input.phone || null,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.user && data.session) {
    await supabase.auth.signOut();
    throw new Error(
      "A confirmacao de e-mail precisa estar habilitada no Supabase antes de liberar novos cadastros.",
    );
  }

  return data;
}

export async function signOut() {
  const supabase = getHrSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentProfile() {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.data.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile | null;
}

export async function getCurrentUserAccess(): Promise<CurrentUserAccess | null> {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    return null;
  }

  const emailConfirmed = isAuthUserEmailConfirmed(user.data.user);

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      *,
      user_roles(
        *,
        role:roles(*)
      )
    `,
    )
    .eq("auth_user_id", user.data.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const profile = data as CurrentUserAccess["profile"];
  const now = Date.now();
  const roles =
    profile?.user_roles
      ?.filter(
        (userRole) =>
          userRole.is_active &&
          userRole.role?.is_active &&
          (!userRole.expires_at || new Date(userRole.expires_at).getTime() > now),
      )
      .map((userRole) => userRole.role as Role)
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")) ?? [];

  return {
    authUserId: user.data.user.id,
    email: user.data.user.email ?? null,
    emailConfirmed,
    profile,
    roles,
  };
}

export function hasMasterRole(access?: CurrentUserAccess | null) {
  return Boolean(access?.roles.some((role) => role.key === "master"));
}

export async function ensureCurrentUserIsMaster() {
  const access = await getCurrentUserAccess();

  if (!hasMasterRole(access)) {
    throw new Error("Somente usuários Master podem excluir registros.");
  }

  return access;
}

export async function requestCurrentUserAccessReview() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase.rpc("request_access_review");

  if (error) {
    throw new Error(error.message);
  }

  const requestId = typeof data === "string" ? data : null;

  if (requestId && typeof window !== "undefined") {
    void fetch("/api/hr/access-requests/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId }),
    }).catch(() => undefined);
  }

  return requestId;
}
