import { LaborCostDashboardPanel } from "@/modules/hr/components/LaborCostDashboardPanel";
import { PageHeader } from "@/modules/hr/components/PageHeader";

export function PayrollPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Folha de pagamento"
        title="Folha de Pagamento"
        description="Visão gerencial dos custos mensais por colaborador, departamento, vínculo e composição da folha."
      />

      <LaborCostDashboardPanel />
    </div>
  );
}
