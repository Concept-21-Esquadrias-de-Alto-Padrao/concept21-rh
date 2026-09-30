"use client";

import { Check, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { FileUploadField } from "@/modules/hr/components/FileUploadField";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { SignedDocumentLink } from "@/modules/hr/components/SignedDocumentLink";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import {
  approveEmployeeDocument,
  listDocumentTypes,
  listEmployeeDocuments,
  rejectEmployeeDocument,
  uploadEmployeeDocument,
} from "@/modules/hr/services/documents.service";
import { listEmployees } from "@/modules/hr/services/employees.service";
import type { DocumentType, Employee, EmployeeDocument } from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { formatDate, formatFileSize } from "@/modules/hr/utils/format";
import { documentStatusLabels } from "@/modules/hr/utils/status";

interface DocumentsPageData {
  documents: EmployeeDocument[];
  employees: Employee[];
  documentTypes: DocumentType[];
}

async function loadDocumentsPageData(): Promise<DocumentsPageData> {
  const [documents, employees, documentTypes] = await Promise.all([
    listEmployeeDocuments(),
    listEmployees({}),
    listDocumentTypes(),
  ]);

  return { documents, employees, documentTypes };
}

export function DocumentsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncResource(loadDocumentsPageData);

  const columns = useMemo<Array<DataTableColumn<EmployeeDocument>>>(
    () => [
      {
        key: "employee",
        header: "Colaborador",
        render: (document) => (
          <div>
            <p className="font-medium text-zinc-950">{document.employee?.full_name ?? "-"}</p>
            <p className="font-mono text-xs text-zinc-500">{document.employee?.employee_number}</p>
          </div>
        ),
      },
      {
        key: "type",
        header: "Documento",
        render: (document) => document.document_type?.name ?? "-",
      },
      {
        key: "expiration",
        header: "Validade",
        render: (document) => formatDate(document.expiration_date),
      },
      {
        key: "status",
        header: "Status",
        render: (document) => (
          <StatusBadge
            label={documentStatusLabels[document.status] ?? document.status}
            status={document.status}
          />
        ),
      },
      {
        key: "file",
        header: "Arquivo",
        render: (document) => (
          <div>
            <p className="text-xs text-zinc-500">{formatFileSize(document.file_size_bytes)}</p>
            <SignedDocumentLink document={document} />
          </div>
        ),
      },
      {
        key: "actions",
        header: "Ações",
        render: (document) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                setActionError(null);

                try {
                  await approveEmployeeDocument(document.id);
                  await reload();
                } catch (approveError) {
                  setActionError(toUserFriendlyErrorMessage(approveError, "Não foi possível aprovar o documento."));
                }
              }}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-emerald-200 hover:text-emerald-700"
              title="Aprovar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                const reason = window.prompt("Motivo da recusa");
                if (reason) {
                  setActionError(null);

                  try {
                    await rejectEmployeeDocument(document.id, reason);
                    await reload();
                  } catch (rejectError) {
                    setActionError(toUserFriendlyErrorMessage(rejectError, "Não foi possível recusar o documento."));
                  }
                }
              }}
              className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-red-200 hover:text-red-600"
              title="Recusar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [reload],
  );

  async function submitDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      if (!employeeId || !documentTypeId) {
        throw new Error("Colaborador e tipo de documento são obrigatórios.");
      }

      await uploadEmployeeDocument({
        employeeId,
        documentTypeId,
        file: file ?? undefined,
        issueDate: issueDate || undefined,
        expirationDate: expirationDate || undefined,
        notes: notes || undefined,
      });

      setDrawerOpen(false);
      setEmployeeId("");
      setDocumentTypeId("");
      setIssueDate("");
      setExpirationDate("");
      setNotes("");
      setFile(null);
      await reload();
    } catch (submitError) {
      setFormError(toUserFriendlyErrorMessage(submitError, "Não foi possível salvar o documento."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Storage privado"
        title="Documentos"
        description="Controle de documentos dos colaboradores com validade, status, aprovação e URL assinada."
        actions={
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
          >
            <Plus className="h-4 w-4" />
            Novo documento
          </button>
        }
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {actionError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {data ? (
        <SectionCard title="Documentos de RH" description={`${data.documents.length} documento(s)`}>
          <DataTable
            data={data.documents}
            columns={columns}
            getRowKey={(document) => document.id}
            emptyState={<EmptyState title="Nenhum documento enviado" />}
          />
        </SectionCard>
      ) : null}

      <DrawerForm
        open={drawerOpen}
        title="Novo documento"
        description="Cadastre o documento e anexe um arquivo agora ou depois."
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={submitDocument} className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <FormField label="Colaborador" required>
            <select
              className={fieldClassName}
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Selecione</option>
              {data?.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Tipo de documento" required>
            <select
              className={fieldClassName}
              value={documentTypeId}
              onChange={(event) => setDocumentTypeId(event.target.value)}
            >
              <option value="">Selecione</option>
              {data?.documentTypes.map((documentType) => (
                <option key={documentType.id} value={documentType.id}>
                  {documentType.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Data de emissao">
              <input
                type="date"
                className={fieldClassName}
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </FormField>
            <FormField label="Data de validade">
              <input
                type="date"
                className={fieldClassName}
                value={expirationDate}
                onChange={(event) => setExpirationDate(event.target.value)}
              />
            </FormField>
          </div>

          <FileUploadField label="Arquivo (opcional)" file={file} onChange={setFile} />

          <FormField label="Observacoes">
            <textarea
              className={`${fieldClassName} min-h-24`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-5">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c] disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar documento"}
            </button>
          </div>
        </form>
      </DrawerForm>
    </div>
  );
}
