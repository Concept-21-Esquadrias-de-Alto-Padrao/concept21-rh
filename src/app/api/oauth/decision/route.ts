import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAllowedOAuthRedirect } from "@/lib/oauth-pilot";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (process.env.CENTRAL_OAUTH_PILOT_ENABLED !== "true" ||
      !process.env.CENTRAL_OAUTH_ALLOWED_CLIENT_ID) {
    return NextResponse.json({ error: "Piloto indisponível." }, { status: 404 });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  const form = await request.formData();
  const authorizationId = form.get("authorization_id");
  const decision = form.get("decision");
  if (typeof authorizationId !== "string" || !authorizationId ||
      authorizationId.length > 256 || (decision !== "approve" && decision !== "deny")) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Entre no RH novamente." }, { status: 401 });
  }
  const { data: details, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailsError || !details || !("authorization_id" in details) ||
      details.client.id !== process.env.CENTRAL_OAUTH_ALLOWED_CLIENT_ID ||
      !isAllowedOAuthRedirect(details.redirect_uri)) {
    return NextResponse.json({ error: "Aplicativo não autorizado." }, { status: 403 });
  }

  if (decision === "approve") {
    const { data: profile, error: profileError } = await getSupabaseAdminClient()
      .from("profiles")
      .select("is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (profileError || !profile?.is_active || !user.email_confirmed_at) {
      return NextResponse.json({ error: "Identidade sem acesso ativo." }, { status: 403 });
    }
  }

  const result = decision === "approve"
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (result.error || !result.data) {
    return NextResponse.json({ error: "Não foi possível concluir a autorização." }, { status: 400 });
  }
  if (!isAllowedOAuthRedirect(result.data.redirect_url)) {
    return NextResponse.json({ error: "Destino inválido." }, { status: 403 });
  }
  return NextResponse.redirect(result.data.redirect_url, { status: 303 });
}
