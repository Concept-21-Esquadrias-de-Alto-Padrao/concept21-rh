import { createAuditLog, createEmployeeHistoryEvent } from "@/modules/hr/services/audit.service";
import { ensureCurrentUserIsMaster } from "@/modules/hr/services/auth.service";
import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type {
  DocumentType,
  EmployeeDocument,
  EmployeeDocumentStatus,
  ID,
} from "@/modules/hr/types";

const DEFAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function sanitizeFileName(fileName: string) {
  const safeName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safeName || "documento";
}

export function validateDocumentFile(file: File, documentType?: DocumentType | null) {
  const allowedTypes = documentType?.allowed_mime_types?.length
    ? documentType.allowed_mime_types
    : DEFAULT_ALLOWED_MIME_TYPES;
  const maxFileSizeMb = documentType?.max_file_size_mb ?? 15;
  const errors: string[] = [];

  if (!allowedTypes.includes(file.type)) {
    errors.push("Tipo de arquivo não permitido para este documento.");
  }

  if (file.size > maxFileSizeMb * 1024 * 1024) {
    errors.push(`Arquivo maior que ${maxFileSizeMb} MB.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function listDocumentTypes() {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("document_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DocumentType[];
}

export async function listEmployeeDocuments(employeeId?: ID) {
  const supabase = getHrSupabaseClient();
  let query = supabase
    .from("employee_documents")
    .select(
      `
      *,
      employee:employees(id, full_name, employee_number),
      document_type:document_types(*)
    `,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as EmployeeDocument[];
}

export async function uploadEmployeeDocument(input: {
  employeeId: ID;
  documentTypeId: ID;
  file?: File | null;
  issueDate?: string;
  expirationDate?: string;
  notes?: string;
}) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const documentTypes = await listDocumentTypes();
  const documentType = documentTypes.find((item) => item.id === input.documentTypeId);
  const file = input.file ?? null;
  const validation = file ? validateDocumentFile(file, documentType) : { valid: true, errors: [] };

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const submittedAt = file ? new Date().toISOString() : null;
  const { data: created, error: createError } = await supabase
    .from("employee_documents")
    .insert({
      employee_id: input.employeeId,
      document_type_id: input.documentTypeId,
      original_file_name: file?.name ?? null,
      mime_type: file?.type ?? null,
      file_size_bytes: file?.size ?? null,
      issue_date: input.issueDate,
      expiration_date: input.expirationDate,
      status: (file ? "submitted" : "pending") satisfies EmployeeDocumentStatus,
      notes: input.notes,
      submitted_by: file ? user.data.user?.id : null,
      submitted_at: submittedAt,
      created_by: user.data.user?.id,
      updated_by: user.data.user?.id,
    })
    .select("*")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  if (!file) {
    await createAuditLog({
      action: "document.created",
      entity: "employee_documents",
      entity_id: created.id,
      new_value: created,
    });

    await createEmployeeHistoryEvent({
      employee_id: input.employeeId,
      event_type: "document_registered",
      title: "Documento cadastrado",
      description: documentType ? `Documento ${documentType.name} cadastrado sem anexo.` : "Documento cadastrado sem anexo.",
      source_entity: "employee_documents",
      source_entity_id: created.id,
    });

    return created as EmployeeDocument;
  }

  const path = `employees/${input.employeeId}/documents/${created.id}-${sanitizeFileName(
    file.name,
  )}`;

  const { error: uploadError } = await supabase.storage
    .from("hr-documents")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    await supabase
      .from("employee_documents")
      .update({
        status: "rejected",
        rejection_reason: uploadError.message,
      })
      .eq("id", created.id);

    throw new Error(uploadError.message);
  }

  const { data: updated, error: updateError } = await supabase
    .from("employee_documents")
    .update({
      storage_path: path,
      storage_bucket: "hr-documents",
      updated_by: user.data.user?.id,
    })
    .eq("id", created.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  await createAuditLog({
    action: "document.uploaded",
    entity: "employee_documents",
    entity_id: updated.id,
    new_value: updated,
  });

  await createEmployeeHistoryEvent({
    employee_id: input.employeeId,
    event_type: "document_uploaded",
    title: "Documento enviado",
    description: documentType ? `Documento ${documentType.name} enviado.` : "Documento enviado.",
    source_entity: "employee_documents",
    source_entity_id: updated.id,
  });

  return updated as EmployeeDocument;
}

export async function generateDocumentSignedUrl(document: EmployeeDocument, expiresIn = 300) {
  if (!document.storage_path) {
    throw new Error("Documento sem arquivo vinculado.");
  }

  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase.storage
    .from(document.storage_bucket || "hr-documents")
    .createSignedUrl(document.storage_path, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export async function replaceEmployeeDocument(documentId: ID, file: File) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const { data: current, error: currentError } = await supabase
    .from("employee_documents")
    .select("*, document_type:document_types(*)")
    .eq("id", documentId)
    .single();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const typedCurrent = current as unknown as EmployeeDocument;
  const validation = validateDocumentFile(file, typedCurrent.document_type);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const path = `employees/${typedCurrent.employee_id}/documents/${documentId}-${sanitizeFileName(
    file.name,
  )}`;

  const { error: uploadError } = await supabase.storage
    .from("hr-documents")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("employee_documents")
    .update({
      storage_path: path,
      original_file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      status: "submitted",
      submitted_by: user.data.user?.id,
      submitted_at: new Date().toISOString(),
      updated_by: user.data.user?.id,
    })
    .eq("id", documentId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "document.replaced",
    entity: "employee_documents",
    entity_id: documentId,
    old_value: typedCurrent,
    new_value: data,
  });

  return data as EmployeeDocument;
}

export async function approveEmployeeDocument(documentId: ID) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("employee_documents")
    .update({
      status: "approved",
      approved_by: user.data.user?.id,
      approved_at: new Date().toISOString(),
      updated_by: user.data.user?.id,
    })
    .eq("id", documentId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "document.approved",
    entity: "employee_documents",
    entity_id: documentId,
    new_value: data,
  });

  return data as EmployeeDocument;
}

export async function rejectEmployeeDocument(documentId: ID, reason: string) {
  const supabase = getHrSupabaseClient();
  const user = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("employee_documents")
    .update({
      status: "rejected",
      rejected_by: user.data.user?.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
      updated_by: user.data.user?.id,
    })
    .eq("id", documentId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "document.rejected",
    entity: "employee_documents",
    entity_id: documentId,
    new_value: data,
  });

  return data as EmployeeDocument;
}

export async function logicallyRemoveEmployeeDocument(documentId: ID) {
  await ensureCurrentUserIsMaster();

  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("employee_documents")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLog({
    action: "document.unlinked",
    entity: "employee_documents",
    entity_id: documentId,
    new_value: data,
  });

  return data as EmployeeDocument;
}
