import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { assertHomologationTarget, atomicBootstrapSql, bootstrapFiles, checksum, config, parseCliJson, privateDir, queryHomologation, root, runCli, sqlLiteral } from "./lib/homologation.mjs";

async function main() {
  assertHomologationTarget();
  mkdirSync(privateDir, { recursive: true });
  console.log(`Destino: ${config.name} (${config.supabaseProjectRef}).`);
  const [state] = queryHomologation("select to_regclass('app.homologation_bootstrap_files') is not null as initialized, to_regclass('public.employees') is not null as has_employees;");
  if (!state.initialized && state.has_employees) {
    throw new Error("O destino já contém estrutura de RH sem identificação de homologação. Verifique antes de prosseguir.");
  }
  queryHomologation(`
    create schema if not exists app;
    create table if not exists app.homologation_bootstrap_files (file_name text primary key, checksum text not null, applied_at timestamptz not null default now());
    revoke all on app.homologation_bootstrap_files from public, anon, authenticated;
  `);
  const applied = new Map(queryHomologation("select file_name, checksum from app.homologation_bootstrap_files;").map((row) => [row.file_name, row.checksum]));
  for (const file of [...bootstrapFiles(), "supabase/homologation/fixtures.sql", "supabase/homologation/block-email.sql"]) {
    const sql = readFileSync(path.join(root, file), "utf8");
    const digest = checksum(sql);
    if (applied.has(file)) {
      if (applied.get(file) !== digest) throw new Error(`Arquivo já aplicado foi alterado: ${file}. Crie uma atualização separada.`);
      continue;
    }
    console.log(`Aplicando ${file}.`);
    queryHomologation(atomicBootstrapSql(sql, file, digest));
  }

  const keyResponse = parseCliJson(runCli("supabase@2.121.0", ["projects", "api-keys", "--project-ref", config.supabaseProjectRef, "--reveal", "--output-format", "json"]));
  const keys = Array.isArray(keyResponse) ? keyResponse : keyResponse.keys ?? keyResponse.api_keys ?? keyResponse.data ?? keyResponse.rows ?? [];
  const anon = (keys.find((key) => key.type === "publishable") ?? keys.find((key) => key.name === "anon"))?.api_key;
  const secret = (keys.find((key) => key.type === "secret") ?? keys.find((key) => key.name === "service_role"))?.api_key;
  if (!anon || !secret) throw new Error("Chaves do banco de homologação não retornaram no formato esperado.");
  const env = {
    NEXT_PUBLIC_APP_ENV: "homologation",
    NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF: config.supabaseProjectRef,
    NEXT_PUBLIC_SUPABASE_URL: `https://${config.supabaseProjectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    SUPABASE_SERVICE_ROLE_KEY: secret,
    NEXT_PUBLIC_APP_URL: config.appUrl,
  };
  writeFileSync(path.join(privateDir, "app-env.json"), JSON.stringify(env, null, 2), { mode: 0o600 });

  const authConfigDir = path.join(privateDir, "supabase");
  mkdirSync(authConfigDir, { recursive: true });
  writeFileSync(path.join(authConfigDir, "config.toml"), `project_id = "rh-concept21-homologacao"\n[auth]\nsite_url = "${config.appUrl}"\nadditional_redirect_urls = ["${config.appUrl}/auth/callback"]\nenable_signup = false\n[auth.email]\nenable_signup = true\nenable_confirmations = true\n[auth.hook.send_email]\nenabled = true\nuri = "pg-functions://postgres/app/block_homologation_email"\n`);
  const configArgs = ["config", "diff", "--project-ref", config.supabaseProjectRef, "--workdir", privateDir];
  const configDiff = parseCliJson(runCli("supabase@2.121.0", configArgs));
  console.log(`Configuração Auth de ${config.supabaseProjectRef}: ${configDiff.counts?.update ?? 0} atualização(ões), ${configDiff.counts?.local_only ?? 0} nova(s) configuração(ões).`);
  runCli("supabase@2.121.0", ["config", "push", "--project-ref", config.supabaseProjectRef, "--workdir", privateDir, "--yes"]);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const accessFile = path.join(privateDir, "access.json");
  const credentials = existsSync(accessFile) ? JSON.parse(readFileSync(accessFile, "utf8")) : [];
  for (const role of ["master", "rh", "colaborador"]) {
    let account = credentials.find((item) => item.role === role);
    if (!account) {
      account = { role, email: `${role}@rh-homologacao.example.invalid`, password: randomBytes(20).toString("base64url") };
      credentials.push(account);
      writeFileSync(accessFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
    }
    const matches = queryHomologation(`select id from auth.users where email = ${sqlLiteral(account.email)};`);
    let userId = matches[0]?.id;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: { full_name: `TESTE RH - ${role}` } });
      if (error) throw new Error(`Falha ao criar conta de teste ${role}: ${error.message}`);
      userId = data.user.id;
    }
    queryHomologation(`
      insert into public.user_roles (profile_id, role_id)
      select p.id, r.id from public.profiles p cross join public.roles r
      where p.auth_user_id = ${sqlLiteral(userId)}::uuid and r.key = ${sqlLiteral(role)}
      on conflict (profile_id, role_id) do nothing;
      ${role === "colaborador" ? `update public.employees set profile_id = (select id from public.profiles where auth_user_id = ${sqlLiteral(userId)}::uuid) where employee_number = 'HOM-003';` : ""}
    `);
  }
  const [safety] = queryHomologation("select count(*) filter (where not relrowsecurity) as tables_without_rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';");
  if (Number(safety.tables_without_rls) !== 0) throw new Error("Há tabelas expostas sem RLS; homologação não está pronta.");
  console.log("Estrutura e dados fictícios provisionados. Credenciais salvas em .homologation/access.json (ignorado no Git e no deploy).");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
