import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isReviewedPilotAdmin } from "@/lib/corporate-pilot-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (process.env.CORPORATE_GATE_ENABLED !== "true") return NextResponse.json({ master: false }, { status: 404 });
  const expected = process.env.PORTAL_GATE_SYNC_SECRET;
  const header = request.headers.get("authorization");
  if (!expected || expected.length < 32 || !header?.startsWith("Bearer ") ||
      !timingSafeEqual(createHash("sha256").update(header.slice(7)).digest(),
        createHash("sha256").update(expected).digest()))
    return NextResponse.json({ master: false }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const authUserId = body && typeof body === "object" && "authUserId" in body ? body.authUserId : null;
  if (typeof authUserId !== "string" || !uuid.test(authUserId))
    return NextResponse.json({ master: false }, { status: 400 });
  if (!isReviewedPilotAdmin(authUserId, process.env.CORPORATE_GATE_PILOT_USER_ID,
    process.env.CORPORATE_GATE_RECOVERY_ADMIN_USER_ID))
    return NextResponse.json({ master: false }, { status: 403 });

  const admin = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,is_active").eq("auth_user_id", authUserId).maybeSingle();
  if (profileError) return NextResponse.json({ master: false }, { status: 503 });
  if (!profile?.is_active) return NextResponse.json({ master: false });
  const { data: grants, error: grantsError } = await admin.from("user_roles")
    .select("role_id,expires_at").eq("profile_id", profile.id).eq("is_active", true);
  if (grantsError) return NextResponse.json({ master: false }, { status: 503 });
  const ids = (grants ?? []).filter((grant) => !grant.expires_at ||
    new Date(grant.expires_at).getTime() > Date.now()).map((grant) => grant.role_id);
  if (!ids.length) return NextResponse.json({ master: false });
  const { data: roles, error: rolesError } = await admin.from("roles")
    .select("id").in("id", ids).eq("key", "master").eq("is_active", true).limit(1);
  if (rolesError) return NextResponse.json({ master: false }, { status: 503 });
  return NextResponse.json({ master: Boolean(roles?.length) }, { headers: { "Cache-Control": "no-store" } });
}
