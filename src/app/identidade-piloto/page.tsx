import Link from "next/link";

import { CorporateIdentityError, getMyCorporateIdentityPilot } from "@/lib/corporate-identity";

export const dynamic = "force-dynamic";

const moduleNames: Record<string, string> = {
  rh: "RH",
  technical: "Técnico",
  production: "Produção",
  works: "Obras",
  activities: "Atividades",
  supplies: "Suprimentos",
};

export default async function IdentityPilotPage() {
  let identity: Awaited<ReturnType<typeof getMyCorporateIdentityPilot>> | null = null;
  let message: string | null = null;
  let needsLogin = false;

  try {
    identity = await getMyCorporateIdentityPilot();
  } catch (error) {
    message = error instanceof CorporateIdentityError ? error.message : "Não foi possível consultar o registro.";
    needsLogin = error instanceof CorporateIdentityError && error.status === 401;
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-8 text-zinc-900">
      <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Concept21 · Acessos</p>
      <h1 className="mt-3 text-3xl font-semibold">Identidade corporativa</h1>
      <p className="mt-3 text-zinc-600">
        Consulta piloto dos vínculos aprovados. Cada módulo continua validando seu próprio login e suas permissões.
      </p>
      {identity ? (
        <section className="mt-8 rounded-xl border border-zinc-200 p-6">
          <h2 className="text-xl font-semibold">{identity.displayName}</h2>
          <p className="mt-2 text-sm text-zinc-500">ID corporativo: {identity.identityId}</p>
          <h3 className="mt-6 font-medium">Contas vinculadas na revisão</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {identity.approvedModules.map((moduleKey) => (
              <li key={moduleKey} className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-900">
                {moduleNames[moduleKey] ?? moduleKey}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-zinc-600">
            {identity.productionTechnicalPair
              ? "Vínculo Produção–Técnico encontrado. A entrada única nesses módulos ainda não foi ativada."
              : "Esta identidade não tem o par Produção–Técnico aprovado."}
          </p>
        </section>
      ) : (
        <section className="mt-8 rounded-xl border border-zinc-200 p-6">
          <p>{message}</p>
          {needsLogin && (
            <Link className="mt-4 inline-block font-medium text-orange-700 underline" href="/login">
              Entrar no RH
            </Link>
          )}
        </section>
      )}
    </main>
  );
}
