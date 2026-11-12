import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { secureOrigin, trustedReferrer } from "@/lib/portal-session-policy";

export async function GET(request: NextRequest) {
  const portal = secureOrigin(process.env.NEXT_PUBLIC_PORTAL_ORIGIN);
  const app = secureOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const failure = new URL("/login", request.url);
  if (!portal || !app || !url || !key || request.nextUrl.origin !== app ||
      !trustedReferrer(request.headers.get("referer"),[portal]))
    return NextResponse.redirect(failure,{status:303});
  const {data:config} = await getSupabaseAdminClient().from("platform_identity_config")
    .select("enabled").eq("key","central_login").maybeSingle();
  if (!config?.enabled) return NextResponse.redirect(new URL("/rh",app),{status:303});
  const response = NextResponse.redirect(failure,{status:303});
  response.headers.set("Cache-Control","private, no-store");
  const auth = createServerClient(url,key,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:(items,responseHeaders)=>{
      items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      Object.entries(responseHeaders).forEach(([name,value])=>response.headers.set(name,value));
    },
  }});
  const {data,error}=await auth.auth.signInWithOAuth({
    provider:"custom:concept21-portal",
    options:{redirectTo:app+"/auth/complete?next=%2Frh",scopes:"openid email profile",skipBrowserRedirect:true},
  });
  if (!error && data.url) response.headers.set("Location",data.url);
  return response;
}
