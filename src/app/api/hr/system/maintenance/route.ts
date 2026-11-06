import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Sessão não autorizada." }, { status: 401, headers });
    }

    const { data, error } = await client.from("hr_module_maintenance")
      .select("enabled, message, updated_at")
      .eq("id", true)
      .single();
    if (error || !data) throw error ?? new Error("Estado da manutenção não encontrado.");
    return NextResponse.json({ maintenance: data }, { headers });
  } catch (error) {
    console.error("Falha ao consultar manutenção do RH", error);
    return NextResponse.json({ error: "Não foi possível consultar a manutenção do RH." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("enabled" in body) || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Informe enabled como booleano." }, { status: 400, headers });
    }

    const client = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Sessão não autorizada." }, { status: 401, headers });
    }

    // The database policy checks the active Master role and binds updated_by
    // to auth.uid(); this route never uses a service role to change the state.
    const { data, error } = await client.from("hr_module_maintenance")
      .update({ enabled: body.enabled, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", true)
      .select("enabled, message, updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Somente Master pode alterar a manutenção do RH." }, { status: 403, headers });
    }
    return NextResponse.json({ maintenance: data }, { headers });
  } catch (error) {
    console.error("Falha ao alterar manutenção do RH", error);
    return NextResponse.json({ error: "Não foi possível alterar a manutenção do RH." }, { status: 503, headers });
  }
}
