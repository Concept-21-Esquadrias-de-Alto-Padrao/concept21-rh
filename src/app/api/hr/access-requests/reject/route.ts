import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RejectRequestBody = {
  profileId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RejectRequestBody;

  if (!body.profileId) {
    return NextResponse.json({ error: "profileId obrigatório." }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão não autorizada." }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const { data: requesterProfile, error: requesterProfileError } = await admin
    .from("profiles")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (requesterProfileError) {
    return NextResponse.json({ error: requesterProfileError.message }, { status: 500 });
  }

  if (!requesterProfile?.is_active) {
    return NextResponse.json({ error: "Somente usuários Master podem recusar cadastros." }, { status: 403 });
  }

  const { data: requesterMasterRole, error: requesterRoleError } = await admin
    .from("user_roles")
    .select("id, expires_at, role:roles!inner(key, is_active)")
    .eq("profile_id", requesterProfile.id)
    .eq("is_active", true)
    .eq("role.key", "master")
    .eq("role.is_active", true)
    .maybeSingle();

  if (requesterRoleError) {
    return NextResponse.json({ error: requesterRoleError.message }, { status: 500 });
  }

  const masterRoleExpired =
    requesterMasterRole?.expires_at &&
    new Date(requesterMasterRole.expires_at).getTime() <= Date.now();

  if (!requesterMasterRole || masterRoleExpired) {
    return NextResponse.json({ error: "Somente usuários Master podem recusar cadastros." }, { status: 403 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, auth_user_id, email")
    .eq("id", body.profileId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  if (profile.auth_user_id === user.id) {
    return NextResponse.json({ error: "Você não pode recusar o próprio cadastro." }, { status: 400 });
  }

  await admin.from("platform_notifications").delete().eq("metadata->>profile_id", profile.id);
  await admin.from("email_notification_queue").delete().eq("metadata->>profile_id", profile.id);

  if (profile.auth_user_id) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(profile.auth_user_id);

    if (deleteUserError) {
      return NextResponse.json({ error: deleteUserError.message }, { status: 500 });
    }
  } else {
    const { error: deleteProfileError } = await admin.from("profiles").delete().eq("id", profile.id);

    if (deleteProfileError) {
      return NextResponse.json({ error: deleteProfileError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
