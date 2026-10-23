export function normalizeDocumentRejectionReason(reason: string) {
  const normalized = reason.trim();
  if (!normalized) {
    throw new Error("Informe o motivo da recusa do documento.");
  }
  return normalized;
}
