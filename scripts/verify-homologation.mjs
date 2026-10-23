import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config, privateDir, assertHomologationTarget } from "./lib/homologation.mjs";

assertHomologationTarget();
const env = JSON.parse(readFileSync(path.join(privateDir, "app-env.json"), "utf8"));
const accounts = JSON.parse(readFileSync(path.join(privateDir, "access.json"), "utf8"));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, `https://${config.supabaseProjectRef}.supabase.co`);
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
async function check(name, operation) {
  await operation();
  results.push({ name, passed: true });
  console.log(`OK: ${name}`);
}
function requireData(response) {
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

async function main() {
  const anon = client();
  const sessions = {};
  await check("Auth de testes bloqueia novos cadastros", async () => {
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).disable_signup, true);
    const signup = await anon.auth.signUp({ email: `verificacao-${randomUUID()}@example.invalid`, password: randomUUID() });
    assert.ok(signup.error, "Cadastro de testes deveria estar bloqueado no servidor.");
  });
  await check("Acesso anônimo não retorna colaboradores", async () => {
    const response = await anon.from("employees").select("id");
    assert.equal(response.data?.length ?? 0, 0);
  });
  await check("Supabase Auth bloqueia envio de recuperação de senha", async () => {
    const response = await anon.auth.resetPasswordForEmail(accounts[0].email);
    assert.ok(response.error?.message.includes("HOMOLOGACAO_EMAIL_BLOCKED"), "O envio deveria ser recusado pelo hook de homologação.");
  });
  for (const account of accounts) {
    await check(`Login separado do perfil ${account.role}`, async () => {
      const userClient = client();
      const data = requireData(await userClient.auth.signInWithPassword({ email: account.email, password: account.password }));
      assert.ok(data.user?.email_confirmed_at);
      const profile = requireData(await userClient.from("profiles").select("id, user_roles(role:roles(key))").eq("auth_user_id", data.user.id).single());
      assert.ok(profile.user_roles.some((item) => item.role.key === account.role));
      sessions[account.role] = userClient;
    });
  }
  const master = sessions.master;
  const employees = requireData(await master.from("employees").select("id, employee_number, profile_id").like("employee_number", "HOM-%"));
  await check("Master e RH veem a massa fictícia completa", async () => {
    assert.equal(employees.length, 6);
    assert.equal(requireData(await sessions.rh.from("employees").select("id")).length, 6);
  });
  await check("Conta restrita vê somente o próprio colaborador e não vê salários", async () => {
    const own = requireData(await sessions.colaborador.from("employees").select("id, employee_number"));
    assert.equal(own.length, 1);
    assert.equal(own[0].employee_number, "HOM-003");
    assert.equal(requireData(await sessions.colaborador.rpc("has_permission", { permission_key: "hr.labor_costs.view_sensitive_values" })), false);
    assert.equal(requireData(await sessions.colaborador.from("employee_compensations").select("id")).length, 0);
  });

  const otherEmployee = employees.find((item) => item.employee_number === "HOM-001");
  const type = requireData(await master.from("occurrence_types").select("id").eq("key", "advertencia_escrita").single());
  const occurrenceId = randomUUID();
  const payload = { id: occurrenceId, employee_id: otherEmployee.id, occurrence_type_id: type.id, title: "TESTE RH - verificação automática", description: "Registro temporário fictício.", occurred_at: "2026-10-21T08:07:00", start_date: "2026-10-21", visibility: "restricted", status: "open" };
  try {
    await check("RLS bloqueia escrita da conta restrita em outro colaborador", async () => {
      const response = await sessions.colaborador.from("employee_occurrences").insert(payload);
      assert.equal(response.error?.code, "42501");
    });
    await check("Master grava e consulta ocorrência com a mesma hora", async () => {
      const record = requireData(await master.from("employee_occurrences").insert(payload).select("occurred_at").single());
      assert.ok(record.occurred_at.startsWith("2026-10-21T08:07:00"));
    });
    await check("Somente Master consegue excluir a ocorrência de teste", async () => {
      const denied = requireData(await sessions.rh.from("employee_occurrences").delete().eq("id", occurrenceId).select("id"));
      assert.equal(denied.length, 0);
      const removed = requireData(await master.from("employee_occurrences").delete().eq("id", occurrenceId).select("id"));
      assert.equal(removed.length, 1);
    });
  } finally {
    requireData(await master.from("employee_occurrences").delete().eq("id", occurrenceId));
  }

  const storagePath = `employees/${otherEmployee.id}/documents/${randomUUID()}-teste.png`;
  try {
    await check("Storage de testes permite upload e download autorizado", async () => {
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");
      requireData(await master.storage.from("hr-documents").upload(storagePath, png, { contentType: "image/png" }));
      const signed = requireData(await master.storage.from("hr-documents").createSignedUrl(storagePath, 60));
      assert.equal((await fetch(signed.signedUrl)).status, 200);
    });
    await check("Conta restrita não recebe link do arquivo de outro colaborador", async () => {
      const response = await sessions.colaborador.storage.from("hr-documents").createSignedUrl(storagePath, 60);
      assert.ok(response.error || !response.data?.signedUrl);
    });
  } finally {
    requireData(await master.storage.from("hr-documents").remove([storagePath]));
  }

  await check("Site identifica homologação e bloqueia e-mails externos", async () => {
    const login = await fetch(`${config.appUrl}/login`);
    assert.equal(login.status, 200);
    const markup = await login.text();
    assert.ok(markup.includes("AMBIENTE DE TESTE"));
    assert.ok(markup.includes("[TESTE]"));
    const response = await fetch(`${config.appUrl}/api/hr/access-requests/notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: randomUUID() }) });
    const data = await response.json();
    assert.equal(data.suppressed, true);
    assert.equal(data.sent, 0);
  });
  for (const userClient of Object.values(sessions)) await userClient.auth.signOut();
  writeFileSync(path.join(privateDir, "verification.json"), JSON.stringify({ environment: config.appUrl, project: config.supabaseProjectRef, verifiedAt: new Date().toISOString(), results }, null, 2));
  console.log(`${results.length} verificações de integração concluídas.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
