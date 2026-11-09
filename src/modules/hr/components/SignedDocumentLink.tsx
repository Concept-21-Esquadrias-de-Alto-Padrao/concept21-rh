"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { downloadEmployeeDocument } from "@/modules/hr/services/documents.service";
import type { EmployeeDocument } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

interface SignedDocumentLinkProps {
  document: EmployeeDocument;
}

export function SignedDocumentLink({ document }: SignedDocumentLinkProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDocument() {
    setLoading(true);
    setError(null);

    try {
      const file = await downloadEmployeeDocument(document);
      const objectUrl = URL.createObjectURL(file);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (downloadError) {
      setError(toUserFriendlyErrorMessage(downloadError, "Não foi possível abrir este arquivo."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={openDocument}
        disabled={loading || !document.storage_path}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-[#f97316] hover:text-[#f97316] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {loading ? "Abrindo..." : "Abrir seguro"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
