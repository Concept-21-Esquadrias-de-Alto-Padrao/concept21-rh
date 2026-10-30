import { NextResponse } from "next/server";

import { CorporateIdentityError, getMyCorporateIdentityPilot } from "@/lib/corporate-identity";

export async function GET() {
  try {
    const result = await getMyCorporateIdentityPilot();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CorporateIdentityError ? error.status : 500;
    const message = error instanceof CorporateIdentityError ? error.message : "Falha ao consultar a identidade.";
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
