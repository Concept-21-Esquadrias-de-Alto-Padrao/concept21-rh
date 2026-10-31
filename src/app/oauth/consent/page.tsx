import { redirect } from "next/navigation";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAllowedOAuthRedirect } from "@/lib/oauth-pilot";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;
  const allowedClientId = process.env.CENTRAL_OAUTH_ALLOWED_CLIENT_ID;

  if (!process.env.CENTRAL_OAUTH_PILOT_ENABLED ||
      process.env.CENTRAL_OAUTH_PILOT_ENABLED !== "true" ||
      !allowedClientId || !authorizationId || authorizationId.length > 256) {
    return <p className="p-8">Esta autorização não está disponível.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { data: profile, error: profileError } = await getSupabaseAdminClient()
    .from("profiles")
    .select("is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active || !user.email_confirmed_at) {
    return <p className="p-8">Seu acesso corporativo está indisponível. Procure a administração.</p>;
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    return <p className="p-8">A solicitação expirou ou é inválida. Volte ao módulo e tente novamente.</p>;
  }
  if ("authorization_id" in data &&
      (data.client.id !== allowedClientId || !isAllowedOAuthRedirect(data.redirect_uri))) {
    return <p className="p-8">Este aplicativo não está autorizado no piloto.</p>;
  }
  if (!("authorization_id" in data)) {
    if (!isAllowedOAuthRedirect(data.redirect_url)) {
      return <p className="p-8">O destino da autorização não está permitido.</p>;
    }
    redirect(data.redirect_url);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#111316] px-4 py-10">
      <section className="w-full max-w-md rounded-md bg-white p-6 text-zinc-900 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">Concept21 · Acessos</p>
        <h1 className="mt-2 text-2xl font-semibold">Autorizar acesso</h1>
        <p className="mt-4 text-sm">{data.client.name} solicita sua identificação corporativa.</p>
        <p className="mt-3 break-all text-xs text-zinc-500">Destino: {data.redirect_uri}</p>
        <p className="mt-4 text-sm font-medium">Informações solicitadas</p>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-600">
          {data.scope.split(" ").filter(Boolean).map((scope) => <li key={scope}>{scope}</li>)}
        </ul>
        <form action="/api/oauth/decision" method="POST" className="mt-6 flex gap-3">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button name="decision" value="approve" className="rounded-md bg-orange-500 px-4 py-2 font-semibold text-white">Autorizar</button>
          <button name="decision" value="deny" className="rounded-md border px-4 py-2">Cancelar</button>
        </form>
      </section>
    </main>
  );
}
