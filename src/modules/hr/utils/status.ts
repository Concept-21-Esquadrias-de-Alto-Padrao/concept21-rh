export const documentStatusLabels = {
  pending: "Pendente",
  submitted: "Enviado",
  approved: "Aprovado",
  rejected: "Recusado",
  expired: "Vencido",
  expires_soon: "Vence em breve",
} as const;

export const workflowStatusLabels = {
  requested: "Solicitado",
  approved: "Aprovado",
  rejected: "Recusado",
  in_progress: "Em andamento",
  finished: "Finalizado",
  cancelled: "Cancelado",
} as const;

export const trainingStatusLabels = {
  scheduled: "Agendado",
  completed: "Concluido",
  expired: "Vencido",
  expires_soon: "Vence em breve",
  cancelled: "Cancelado",
} as const;

export const occurrenceStatusLabels = {
  open: "Aberta",
  in_review: "Em análise",
  approved: "Aprovada",
  rejected: "Recusada",
  closed: "Fechada",
  cancelled: "Cancelada",
} as const;

export function statusTone(status?: string | null) {
  if (!status) {
    return "neutral";
  }

  if (["approved", "completed", "ativo", "Ativo", "green"].includes(status)) {
    return "success";
  }

  if (
    [
      "pending",
      "requested",
      "submitted",
      "expires_soon",
      "em_experiencia",
      "Em experiencia",
      "orange",
    ].includes(status)
  ) {
    return "warning";
  }

  if (
    [
      "rejected",
      "expired",
      "cancelled",
      "afastado",
      "desligado",
      "red",
    ].includes(status)
  ) {
    return "danger";
  }

  if (["in_progress", "em_ferias", "blue"].includes(status)) {
    return "info";
  }

  return "neutral";
}
