"use client";

import { useEffect, useState } from "react";

type Maintenance = { enabled: boolean; message: string; updated_at: string };

export function HrMaintenanceControl() {
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/hr/system/maintenance", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível consultar a manutenção.");
        return response.json() as Promise<{ maintenance: Maintenance }>;
      })
      .then((result) => { if (active) setMaintenance(result.maintenance); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Erro ao carregar."); });
    return () => { active = false; };
  }, []);

  async function change(enabled: boolean) {
    if (enabled && !window.confirm("Ativar manutenção somente no módulo RH? As ações operacionais serão bloqueadas para usuários que não são Master. O login central seguirá disponível.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/hr/system/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const result = await response.json() as { maintenance?: Maintenance; error?: string };
      if (!response.ok || !result.maintenance) throw new Error(result.error ?? "Falha ao alterar a manutenção.");
      setMaintenance(result.maintenance);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao alterar a manutenção.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Manutenção do módulo RH</h2>
      <p className="mt-2 text-sm text-zinc-600">Bloqueia as telas e as gravações operacionais do RH. O provedor de identidade e o Portal permanecem disponíveis para outros módulos.</p>
      <p className="mt-4 text-sm font-semibold">{maintenance ? (maintenance.enabled ? "Manutenção ativa" : "Operação normal") : "Carregando estado..."}</p>
      {maintenance?.updated_at ? <p className="text-xs text-zinc-500">Atualizado em {new Date(maintenance.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button type="button" disabled={!maintenance || busy} onClick={() => void change(!maintenance!.enabled)} className="mt-4 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Salvando..." : maintenance?.enabled ? "Desativar manutenção" : "Ativar manutenção"}
      </button>
    </section>
  );
}
