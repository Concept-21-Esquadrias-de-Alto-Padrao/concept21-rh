import { createServerClient } from "@supabase/ssr";
import { type NextRequest,NextResponse } from "next/server";
import { assertSupabasePublicConfig } from "@/lib/supabase/config";
import { checkCorporateAccess } from "@/lib/corporate-access-server";
import { secureOrigin } from "@/lib/portal-session-policy";
export async function GET(request:NextRequest){
 const origin=secureOrigin(process.env.NEXT_PUBLIC_APP_URL);
 const failure=new URL("/login",request.url),code=request.nextUrl.searchParams.get("code");
 if(!origin||request.nextUrl.origin!==origin||!code||request.nextUrl.searchParams.get("next")!=="/rh")
  return NextResponse.redirect(failure,{status:303});
 const response=NextResponse.redirect(new URL("/rh",origin),{status:303});
 response.headers.set("Cache-Control","private,no-store");
 const {url,anonKey}=assertSupabasePublicConfig();
 const auth=createServerClient(url,anonKey,{cookies:{
  getAll:()=>request.cookies.getAll(),
  setAll:(items,responseHeaders)=>{
   items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   Object.entries(responseHeaders).forEach(([name,value])=>response.headers.set(name,value));
  },
 }});
 const {data,error}=await auth.auth.exchangeCodeForSession(code);
 const access=!error&&data.session?await checkCorporateAccess(data.session.access_token):"revoked";
 if(access!=="allowed"){
  await auth.auth.signOut({scope:"local"}).catch(()=>undefined);response.headers.set("Location",failure.toString());
 }
 return response;
}
