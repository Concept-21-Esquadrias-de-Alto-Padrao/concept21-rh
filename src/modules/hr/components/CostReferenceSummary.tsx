import type { LaborCostDashboard } from "@/modules/hr/services/labor-costs.service";
import { formatDateTime } from "@/modules/hr/utils/format";

export function CostReferenceSummary({ dashboard }: { dashboard: LaborCostDashboard }) {
  const stateLabel = dashboard.closing.state === "closed" ? "Fechamento completo dos custos" : dashboard.closing.state === "partial" ? "Fechamento parcial dos custos" : "Estimativa de custos";
  return (
    <div className="space-y-1 border-l-2 border-orange-300 bg-orange-50/60 px-4 py-3 text-sm text-zinc-700">
      <p className="font-semibold text-zinc-950">Competência {dashboard.referenceMonthLabel}: {stateLabel}</p>
      <p>Base dos custos: {dashboard.employeeCount} colaboradores nos filtros atuais, incluindo inativos quando selecionados. Sem remuneração vigente: {dashboard.employeesWithoutCompensation}.</p>
      <p>Conferidos e fechados: {dashboard.closing.closedCount} de {dashboard.employeeCount}. O quadro ativo usa a situação e as datas de vínculo, podendo ter uma quantidade diferente.</p>
      <p className="text-xs text-zinc-500">Consulta atualizada em {formatDateTime(dashboard.refreshedAt)}. Último registro de custos salvo: {dashboard.closing.lastUpdatedAt ? formatDateTime(dashboard.closing.lastUpdatedAt) : "nenhum nesta competência"}.</p>
    </div>
  );
}
