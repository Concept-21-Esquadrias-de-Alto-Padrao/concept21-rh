"use client";

import { useEffect, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Temporary, preview-only probe. Remove this route after the synthetic test.
const TEST_USER_ID = "1648c90c-0b7a-46fc-acf4-32c73cd21c04";
const TEST_PATH =
  "employees/0f06f3f4-fa1b-4818-9b27-709942f23b69/documents/78a4cd9b-ef2d-4c74-b4c8-9348ca388789-corporate-gate-storage-test-20261104.pdf";

export default function StorageProofPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("Aguardando teste.");
  const originalToken = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data, error }) => {
        if (active) setAuthorized(!error && data.user?.id === TEST_USER_ID);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function checkStorage() {
    setRunning(true);
    setResult("Consultando Storage...");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token || sessionData.session?.user.id !== TEST_USER_ID) {
        setResult("Sessão de teste indisponível.");
        return;
      }
      if (originalToken.current && originalToken.current !== token) {
        setResult("O JWT mudou desde a primeira tentativa; esta rodada não comprova revogação do mesmo token.");
        return;
      }
      originalToken.current ??= token;

      const { data, error } = await supabase.storage
        .from("hr-documents")
        .download(TEST_PATH, {}, { cache: "no-store" });
      const { data: afterRequest } = await supabase.auth.getSession();
      if (afterRequest.session?.access_token !== originalToken.current) {
        setResult("O JWT mudou durante a consulta; esta rodada não comprova revogação do mesmo token.");
        return;
      }
      setResult(error ? `Storage negou a leitura: ${error.message}` : `Storage permitiu a leitura: ${data?.size ?? 0} bytes.`);
    } catch (error) {
      setResult(`Falha na consulta: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-6 py-12 text-zinc-800">
      <h1 className="text-2xl font-semibold">Prova temporária do Storage</h1>
      <p>Prévia de homologação. Consulta somente o PDF sintético com a sessão V05; nenhum arquivo é exibido.</p>
      {checking ? <p>Conferindo sessão...</p> : authorized ? (
        <>
          <button
            type="button"
            className="w-fit rounded-md bg-orange-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            disabled={running}
            onClick={checkStorage}
          >
            {running ? "Consultando..." : "Testar leitura autenticada"}
          </button>
          <p role="status">{result}</p>
        </>
      ) : <p>Esta rota temporária exige a sessão V05 de homologação.</p>}
    </main>
  );
}
