"use client";

import {
  AlertTriangle,
  BadgeDollarSign,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { CompetenceFilter, MultiSelectFilter } from "@/components/filters";
import { useFilterSearchParams } from "@/hooks/useFilterSearchParams";
import {
  DonutChartCard,
  GroupedBarChartCard,
  HorizontalBarChartCard,
  LineChartCard,
  RankingTableCard,
} from "@/modules/hr/components/DashboardCharts";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { FormField } from "@/modules/hr/components/FormField";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { MetricCard } from "@/modules/hr/components/MetricCard";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import {
  formatDashboardCurrency,
  getHrDashboardAlerts,
  getHrDashboardCore,
  getHrDashboardCosts,
  getHrDashboardOccurrences,
  type DashboardScope,
} from "@/modules/hr/services/hr-dashboard.service";
import { formatCurrencyBRL, getDefaultReferenceMonth } from "@/modules/hr/utils/labor-cost-calculations";
import { formatDate } from "@/modules/hr/utils/format";
import { formatTurnoverPercentage, type TurnoverStatus } from "@/modules/hr/utils/turnover-calculations";

const turnoverTone: Record<TurnoverStatus, "success" | "warning" | "danger"> = {
  low: "success",
  moderate: "warning",
  high: "danger",
};

const turnoverBadge: Record<TurnoverStatus, string> = {
  low: "Baixo",
  moderate: "Moderado",
  high: "Alto",
};

type OccurrenceRankingRow = {
  label: string;
  detail?: string;
  count: number;
  impactedDays: number;
  topType?: string;
  involvedEmployees?: number;
  percentage?: number;
};

const vacationStatusLabel: Record<string, string> = {
  requested: "Solicitada",
  approved: "Aprovada",
  in_progress: "Em andamento",
};

const dayInMs = 24 * 60 * 60 * 1000;

function isoDateToUtcDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function getTodayUtcDay() {
  const today = new Date();
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

function getVacationProgress(start: string, end: string) {
  const startDay = isoDateToUtcDay(start);
  const endDay = isoDateToUtcDay(end);
  const todayDay = getTodayUtcDay();
  const totalDays = Math.max(Math.round((endDay - startDay) / dayInMs) + 1, 1);
  const elapsedDays =
    todayDay < startDay
      ? 0
      : todayDay > endDay
        ? totalDays
        : Math.round((todayDay - startDay) / dayInMs) + 1;
  const percentage = Math.min(Math.max(Math.round((elapsedDays / totalDays) * 100), 0), 100);
  const label =
    todayDay < startDay
      ? "A iniciar"
      : todayDay > endDay
        ? "Periodo concluido"
        : elapsedDays === totalDays
          ? "Ultimo dia"
          : `${elapsedDays} de ${totalDays} dias`;

  return { elapsedDays, label, percentage, totalDays };
}

function getVacationProgressBarClass(percentage: number) {
  if (percentage >= 100) {
    return "bg-emerald-500";
  }

  if (percentage <= 0) {
    return "bg-zinc-300";
  }

  return "bg-gradient-to-r from-orange-500 to-emerald-500";
}

function SummaryList<T>({
  items,
  render,
  emptyTitle = "Nada pendente",
  emptyDescription = "Nenhum item critico encontrado.",
}: {
  items: T[];
  render: (item: T) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return <div className="divide-y divide-zinc-100">{items.map((item) => render(item))}</div>;
}

function formatPercentagePoint(value: number | null) {
  if (value === null) {
    return "Sem comparativo anterior";
  }

  const prefix = value > 0 ? "+" : "";
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);

  return `${prefix}${formatted} p.p. vs. mes anterior`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function MiniMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="border-l-2 border-orange-200 bg-white/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-zinc-950">{value}</p>
      {detail ? <p className="mt-1 text-sm text-zinc-500">{detail}</p> : null}
    </div>
  );
}

function DashboardBlockLoading({ label = "Carregando informacoes..." }: { label?: string }) {
  return (
    <div className="animate-pulse space-y-3 py-2">
      <div className="h-4 w-48 rounded bg-zinc-200" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-16 rounded bg-zinc-100" />
        <div className="h-16 rounded bg-zinc-100" />
      </div>
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  );
}

function OccurrenceRankingTable({
  title,
  rows,
  emptyTitle,
  showEmployees,
  showPercentage,
}: {
  title: string;
  rows: OccurrenceRankingRow[];
  emptyTitle: string;
  showEmployees?: boolean;
  showPercentage?: boolean;
}) {
  return (
    <SectionCard title={title}>
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Item
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Ocorrencias
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Dias impactados
                </th>
                {showEmployees ? (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Colaboradores
                  </th>
                ) : null}
                {showPercentage ? (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    %
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {rows.map((row) => (
                <tr key={`${title}-${row.label}`} className="transition hover:bg-orange-50/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-950">{row.label}</p>
                    <p className="text-xs text-zinc-500">{row.detail ?? row.topType ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{row.count}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{row.impactedDays}</td>
                  {showEmployees ? (
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {row.involvedEmployees ?? "-"}
                    </td>
                  ) : null}
                  {showPercentage ? (
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatNumber(row.percentage ?? 0)}%
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export function DashboardPage() {
  const filterParams = useFilterSearchParams();
  const defaultReferenceMonth = getDefaultReferenceMonth().slice(0, 7);
  const dashboardScope = filterParams.getEnum<DashboardScope>(
    "scope",
    ["general", "competence"],
    "general",
  );
  const referenceMonth = filterParams.getMonth("competence", defaultReferenceMonth);
  const departmentIds = filterParams.getArray("departments");
  const employmentTypeIds = filterParams.getArray("employmentTypes");
  const statusIds = filterParams.getArray("statuses");
  const resourceKey = `${dashboardScope}-${referenceMonth}-${departmentIds.join(",")}-${employmentTypeIds.join(",")}-${statusIds.join(",")}`;
  const dashboardFilters = {
    scope: dashboardScope,
    referenceMonth: dashboardScope === "competence" ? referenceMonth : undefined,
    departmentIds,
    employmentTypeIds,
    statusIds,
    evolutionMonths: dashboardScope === "competence" ? 6 : 12,
  };
  const {
    data: core,
    loading: coreLoading,
    error: coreError,
  } = useAsyncResource(() => getHrDashboardCore(dashboardFilters), `dashboard-core-${resourceKey}`);
  const {
    data: costs,
    loading: costsLoading,
    error: costsError,
  } = useAsyncResource(() => getHrDashboardCosts(dashboardFilters), `dashboard-costs-${resourceKey}`);
  const {
    data: occurrences,
    error: occurrencesError,
  } = useAsyncResource(
    () => getHrDashboardOccurrences(dashboardFilters),
    `dashboard-occurrences-${resourceKey}`,
  );
  const {
    data: alerts,
    loading: alertsLoading,
    error: alertsError,
  } = useAsyncResource(() => getHrDashboardAlerts(dashboardFilters), `dashboard-alerts-${resourceKey}`);
  const costMetricLoading = Boolean(core?.permissions.canViewCosts && costsLoading && !costs);
  const costHiddenReason = core?.permissions.costsHiddenReason;
  const payrollTotal = costs?.dashboard.totalEstimatedCost ?? null;
  const averageCostPerEmployee = costs?.dashboard.averageCostPerEmployee ?? null;
  const alertSummary = alerts?.summary;

  const costMetricDetail =
    costMetricLoading
      ? "Carregando custos..."
      : payrollTotal === null
        ? costHiddenReason
        : core?.scope === "general"
          ? "Competencia mais recente"
          : "Competencia selecionada";

  const averageCostMetricDetail =
    costMetricLoading
      ? "Carregando custos..."
      : averageCostPerEmployee === null
        ? costHiddenReason
        : "Por colaborador";

  const scopedOccurrencesDescription =
    core?.scope === "general"
      ? "Consolidado histórico de ocorrências, dias impactados e punições."
      : "Ocorrências, dias impactados e punições na competência selecionada.";

  const vacationSectionTitle =
    core?.scope === "general" ? "Férias em andamento e próximas" : "Férias da competência";
  const vacationEmptyTitle =
    core?.scope === "general" ? "Nenhum período de férias em destaque" : "Nenhum lançamento de férias na competência";
  const vacationEmptyDescription =
    core?.scope === "general"
      ? "Não há férias em andamento ou previstas no período de referência."
      : "Não há férias lançadas para o período filtrado.";
  const departmentFilterOptions = useMemo(
    () =>
      core?.options.departments.map((department) => ({
        value: department.id,
        label: department.name,
      })) ?? [],
    [core?.options.departments],
  );
  const employmentTypeFilterOptions = useMemo(
    () =>
      core?.options.employmentTypes.map((item) => ({
        value: item.id,
        label: item.name,
      })) ?? [],
    [core?.options.employmentTypes],
  );
  const statusFilterOptions = useMemo(
    () =>
      core?.options.statuses.map((item) => ({
        value: item.id,
        label: item.name,
      })) ?? [],
    [core?.options.statuses],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Recursos Humanos"
        title="Dashboard de RH"
        description="Visão gerencial de pessoas, custos, turnover, ocorrências e alertas operacionais."
      />

      <div className="space-y-6">
        <SectionCard
          title="Filtros do dashboard"
          description={core ? `${core.scopeLabel} - ${core.scopeDescription}` : undefined}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <FormField label="Modo de visualizacao">
              <div className="grid grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1">
                <button
                  type="button"
                  onClick={() => filterParams.replaceParams({ scope: null, competence: null })}
                  className={`rounded px-3 py-2 text-sm font-semibold transition ${
                    dashboardScope === "general"
                      ? "bg-[#111316] text-white shadow-sm"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  Visão geral
                </button>
                <button
                  type="button"
                  onClick={() =>
                    filterParams.replaceParams({
                      scope: "competence",
                      competence: referenceMonth,
                    })
                  }
                  className={`rounded px-3 py-2 text-sm font-semibold transition ${
                    dashboardScope === "competence"
                      ? "bg-[#f97316] text-white shadow-sm"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  Competencia
                </button>
              </div>
            </FormField>
            <CompetenceFilter
              label="Mes de referencia"
              value={referenceMonth}
              disabled={dashboardScope !== "competence"}
              onChange={(value) => {
                filterParams.replaceParams({
                  scope: "competence",
                  competence: value,
                });
              }}
            />
            <MultiSelectFilter
              label="Departamento"
              ariaLabel="Filtrar dashboard por departamento"
              options={departmentFilterOptions}
              values={departmentIds}
              placeholder="Todos"
              selectedLabel={(count) => `${count} departamentos`}
              onChange={(nextDepartmentIds) => filterParams.replaceParams({ departments: nextDepartmentIds })}
            />
            <MultiSelectFilter
              label="Tipo de vinculo"
              ariaLabel="Filtrar dashboard por tipo de vínculo"
              options={employmentTypeFilterOptions}
              values={employmentTypeIds}
              placeholder="Todos"
              selectedLabel={(count) => `${count} vínculos`}
              onChange={(nextEmploymentTypeIds) =>
                filterParams.replaceParams({ employmentTypes: nextEmploymentTypeIds })
              }
            />
            <MultiSelectFilter
              label="Status"
              ariaLabel="Filtrar dashboard por status"
              options={statusFilterOptions}
              values={statusIds}
              placeholder="Todos"
              selectedLabel={(count) => `${count} status`}
              onChange={(nextStatusIds) => filterParams.replaceParams({ statuses: nextStatusIds })}
            />
          </div>
        </SectionCard>

        {coreLoading && !core ? <LoadingState /> : null}
        {coreError && !core ? <ErrorState message={coreError} /> : null}

        {core ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard
                label="Colaboradores ativos"
                value={core.summary.activeEmployees}
                detail={
                  core.scope === "general"
                    ? `Media historica: ${core.summary.averageHeadcount}`
                    : `Media ativa: ${core.summary.averageHeadcount}`
                }
                tone="success"
                icon={Users}
              />
              <MetricCard
                label="Custo total da folha"
                value={costMetricLoading ? "..." : formatDashboardCurrency(payrollTotal)}
                detail={costMetricDetail}
                tone="warning"
                icon={BadgeDollarSign}
              />
              <MetricCard
                label="Custo medio"
                value={costMetricLoading ? "..." : formatDashboardCurrency(averageCostPerEmployee)}
                detail={averageCostMetricDetail}
                tone="info"
                icon={BadgeDollarSign}
              />
              <MetricCard
                label={core.scope === "general" ? "Turnover medio" : "Turnover do mes"}
                value={formatTurnoverPercentage(core.summary.turnoverRate)}
                detail={formatPercentagePoint(core.summary.turnoverVariationPp)}
                badge={turnoverBadge[core.summary.turnoverStatus]}
                tone={turnoverTone[core.summary.turnoverStatus]}
                icon={TrendingUp}
              />
              <MetricCard
                label={core.scope === "general" ? "Admissoes historicas" : "Admissoes no mes"}
                value={core.summary.admissions}
                detail={core.scope === "general" ? "Desde o início" : "Entradas no período"}
                tone="info"
                icon={UserPlus}
              />
              <MetricCard
                label={core.scope === "general" ? "Desligamentos históricos" : "Desligamentos"}
                value={core.summary.terminations}
                detail={
                  core.scope === "general"
                    ? "Desde o início"
                    : `Turnover desl.: ${formatTurnoverPercentage(core.summary.terminationTurnoverRate)}`
                }
                tone="neutral"
                icon={UserMinus}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <LineChartCard
                  title="Evolução mensal do turnover"
                  description={
                  core.scope === "general"
                    ? "Ultimos 12 meses, conforme filtros selecionados."
                    : "Ultimos 6 meses, conforme filtros selecionados."
                }
                data={core.turnover.evolution}
                valueFormatter={formatTurnoverPercentage}
              />
              <GroupedBarChartCard
                title="Admissoes x desligamentos"
                description="Movimento mensal de entradas e saidas."
                data={core.turnover.admissionsVsTerminations}
                series={[
                  { key: "admissoes", label: "Admissoes", color: "#171a1f" },
                  { key: "desligamentos", label: "Desligamentos", color: "#f97316" },
                ]}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {costs ? (
                <>
                  <HorizontalBarChartCard
                    title="Custo de mao de obra por departamento"
                    description="Departamentos com maior custo estimado no período."
                    data={costs.byDepartment}
                    valueFormatter={formatCurrencyBRL}
                  />
                  <DonutChartCard
                    title="Composicao do custo da folha"
                    description="Distribuição dos componentes que formam o custo total."
                    data={costs.composition}
                    valueFormatter={formatCurrencyBRL}
                  />
                </>
              ) : costsLoading && core.permissions.canViewCosts ? (
                <>
                  <SectionCard title="Custo de mao de obra por departamento">
                    <DashboardBlockLoading label="Carregando custos por departamento..." />
                  </SectionCard>
                  <SectionCard title="Composicao do custo da folha">
                    <DashboardBlockLoading label="Carregando composicao da folha..." />
                  </SectionCard>
                </>
              ) : costsError ? (
                <SectionCard title="Custos de mao de obra">
                  <ErrorState message={costsError} />
                </SectionCard>
              ) : (
                <>
                  <SectionCard title="Custo de mao de obra por departamento">
                    <EmptyState
                      title="Valores financeiros restritos"
                      description={core.permissions.costsHiddenReason}
                      icon={BadgeDollarSign}
                    />
                  </SectionCard>
                  <SectionCard title="Composicao do custo da folha">
                    <EmptyState
                      title="Composicao indisponivel"
                      description={core.permissions.costsHiddenReason}
                      icon={BadgeDollarSign}
                    />
                  </SectionCard>
                </>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <HorizontalBarChartCard
                title="Colaboradores por departamento"
                description="Distribuição do quadro ativo."
                data={core.employeesByDepartment}
              />
              <HorizontalBarChartCard
                title="Turnover por departamento"
                description="Departamentos com maior rotatividade no mes."
                data={core.turnover.byDepartment}
                valueFormatter={formatTurnoverPercentage}
              />
              {occurrences ? (
                <HorizontalBarChartCard
                  title="Ocorrencias por tipo"
                  description="Tipos mais registrados no escopo atual."
                  data={occurrences.byType}
                />
              ) : (
                <SectionCard title="Ocorrencias por tipo" description="Tipos mais registrados no escopo atual.">
                  {occurrencesError ? (
                    <ErrorState message={occurrencesError} />
                  ) : (
                    <DashboardBlockLoading label="Carregando ocorrências por tipo..." />
                  )}
                </SectionCard>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {occurrences ? (
                <>
                  <GroupedBarChartCard
                    title="Faltas e atestados por mes"
                    description="Evolução de ausências no período de análise."
                    data={occurrences.evolution}
                    series={[
                      { key: "faltas", label: "Faltas", color: "#171a1f" },
                      { key: "atestados", label: "Atestados", color: "#f97316" },
                    ]}
                  />
                  <HorizontalBarChartCard
                    title="Departamentos com mais ocorrências"
                    description="Ranking conforme filtros selecionados."
                    data={occurrences.topDepartments}
                  />
                </>
              ) : (
                <>
                  <SectionCard title="Faltas e atestados por mes">
                    {occurrencesError ? (
                      <ErrorState message={occurrencesError} />
                    ) : (
                      <DashboardBlockLoading label="Carregando evolução de ausências..." />
                    )}
                  </SectionCard>
                  <SectionCard title="Departamentos com mais ocorrências">
                    {occurrencesError ? (
                      <ErrorState message={occurrencesError} />
                    ) : (
                      <DashboardBlockLoading label="Carregando ranking de departamentos..." />
                    )}
                  </SectionCard>
                </>
              )}
            </div>

            <SectionCard
              title="Analise de Ocorrencias"
              description={scopedOccurrencesDescription}
            >
              {occurrences ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <MiniMetric
                      label="Total"
                      value={occurrences.analytics.total}
                      detail="Ocorrencias registradas"
                    />
                    <MiniMetric
                      label="Dias impactados"
                      value={occurrences.analytics.impactedDays}
                      detail="Faltas, atestados, suspensoes e afins"
                    />
                    <MiniMetric
                      label="Punicoes"
                      value={occurrences.analytics.punishmentCount}
                      detail={occurrences.analytics.topPunishment?.label ?? "Sem recorrencia"}
                    />
                    <MiniMetric
                      label="Media por colaborador"
                      value={formatNumber(occurrences.analytics.averagePerEmployee)}
                      detail="No escopo atual"
                    />
                    <MiniMetric
                      label="Media por departamento"
                      value={formatNumber(occurrences.analytics.averagePerDepartment)}
                      detail="No escopo atual"
                    />
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MiniMetric
                      label="Colaborador com mais ocorrências"
                      value={
                        core.permissions.canViewOccurrenceSensitive
                          ? occurrences.analytics.topEmployee?.count ?? 0
                          : "Restrito"
                      }
                      detail={
                        core.permissions.canViewOccurrenceSensitive
                          ? occurrences.analytics.topEmployee?.label ?? "Sem dados"
                          : core.permissions.occurrenceSensitiveHiddenReason
                      }
                    />
                    <MiniMetric
                      label="Departamento lider"
                      value={occurrences.analytics.topDepartment?.count ?? 0}
                      detail={occurrences.analytics.topDepartment?.label ?? "Sem dados"}
                    />
                    <MiniMetric
                      label="Tipo mais comum"
                      value={occurrences.analytics.topType?.count ?? 0}
                      detail={occurrences.analytics.topType?.label ?? "Sem dados"}
                    />
                    <MiniMetric
                      label="Categoria lider"
                      value={occurrences.analytics.topCategory?.count ?? 0}
                      detail={occurrences.analytics.topCategory?.label ?? "Sem dados"}
                    />
                  </div>
                </>
              ) : occurrencesError ? (
                <ErrorState message={occurrencesError} />
              ) : (
                <DashboardBlockLoading label="Carregando análise de ocorrências..." />
              )}
            </SectionCard>

            <div className="grid gap-5 xl:grid-cols-2">
              {occurrences ? (
                <>
                  <HorizontalBarChartCard
                    title="Dias impactados por tipo"
                    description="Tipos de ocorrência que mais impactam a operação."
                    data={occurrences.analytics.impactedDaysByType}
                  />
                  <DonutChartCard
                    title="Composicao por categoria"
                    description="Distribuição das ocorrências por categoria."
                    data={occurrences.analytics.categoriesComposition}
                  />
                </>
              ) : (
                <>
                  <SectionCard title="Dias impactados por tipo">
                    {occurrencesError ? (
                      <ErrorState message={occurrencesError} />
                    ) : (
                      <DashboardBlockLoading label="Carregando dias impactados..." />
                    )}
                  </SectionCard>
                  <SectionCard title="Composicao por categoria">
                    {occurrencesError ? (
                      <ErrorState message={occurrencesError} />
                    ) : (
                      <DashboardBlockLoading label="Carregando categorias..." />
                    )}
                  </SectionCard>
                </>
              )}
            </div>

            {core.permissions.canViewOccurrenceRankings ? (
              <div className="grid gap-5 xl:grid-cols-3">
                {occurrences ? (
                  core.permissions.canViewOccurrenceSensitive ? (
                    <OccurrenceRankingTable
                      title="Ranking de colaboradores"
                      rows={occurrences.analytics.employeesRanking}
                      emptyTitle="Nenhuma ocorrência por colaborador"
                    />
                  ) : (
                    <SectionCard title="Ranking de colaboradores">
                      <EmptyState
                        title="Ranking nominal restrito"
                        description={core.permissions.occurrenceSensitiveHiddenReason}
                      />
                    </SectionCard>
                  )
                ) : occurrencesError ? (
                  <SectionCard title="Ranking de colaboradores">
                    <ErrorState message={occurrencesError} />
                  </SectionCard>
                ) : (
                  <SectionCard title="Ranking de colaboradores">
                    <DashboardBlockLoading label="Carregando rankings..." />
                  </SectionCard>
                )}
                {occurrences ? (
                  <>
                    <OccurrenceRankingTable
                      title="Ranking de departamentos"
                      rows={occurrences.analytics.departmentsRanking}
                      emptyTitle="Nenhuma ocorrência por departamento"
                      showEmployees
                    />
                    <OccurrenceRankingTable
                      title="Ranking de tipos"
                      rows={occurrences.analytics.typesRanking}
                      emptyTitle="Nenhuma ocorrência por tipo"
                      showPercentage
                    />
                  </>
                ) : (
                  <>
                    <SectionCard title="Ranking de departamentos">
                      {occurrencesError ? (
                        <ErrorState message={occurrencesError} />
                      ) : (
                        <DashboardBlockLoading label="Carregando ranking de departamentos..." />
                      )}
                    </SectionCard>
                    <SectionCard title="Ranking de tipos">
                      {occurrencesError ? (
                        <ErrorState message={occurrencesError} />
                      ) : (
                        <DashboardBlockLoading label="Carregando ranking de tipos..." />
                      )}
                    </SectionCard>
                  </>
                )}
              </div>
            ) : (
              <SectionCard title="Rankings de ocorrências">
                <EmptyState
                  title="Rankings restritos"
                  description={core.permissions.occurrenceRankingsHiddenReason}
                />
              </SectionCard>
            )}

            <div className="grid gap-5 xl:grid-cols-2">
              {costs ? (
                <>
                  <RankingTableCard
                    title="Colaboradores com maior custo mensal"
                    data={costs.topEmployeesByCost}
                    valueFormatter={formatCurrencyBRL}
                  />
                  <RankingTableCard
                    title="Colaboradores com maior custo hora"
                    data={costs.topEmployeesByHourCost}
                    valueFormatter={formatCurrencyBRL}
                  />
                </>
              ) : costsLoading && core.permissions.canViewCosts ? (
                <SectionCard title="Rankings financeiros">
                  <DashboardBlockLoading label="Carregando rankings financeiros..." />
                </SectionCard>
              ) : costsError ? (
                <SectionCard title="Rankings financeiros">
                  <ErrorState message={costsError} />
                </SectionCard>
              ) : (
                <SectionCard title="Rankings financeiros">
                  <EmptyState
                    title="Rankings financeiros restritos"
                    description={core.permissions.costsHiddenReason}
                    icon={BadgeDollarSign}
                  />
                </SectionCard>
              )}

              <SectionCard title="Alertas do RH" description="Documentos, treinamentos e afastamentos que pedem atencao.">
                {alertsError && !alerts ? (
                  <ErrorState message={alertsError} />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-red-100 bg-red-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-700">Docs vencidos</p>
                      <p className="mt-2 font-mono text-2xl font-semibold text-red-950">
                        {alertsLoading && !alertSummary ? "..." : alertSummary?.expiredDocuments ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border border-orange-100 bg-orange-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-700">Docs vencendo</p>
                      <p className="mt-2 font-mono text-2xl font-semibold text-orange-950">
                        {alertsLoading && !alertSummary ? "..." : alertSummary?.expiringDocuments ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border border-red-100 bg-red-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-700">Trein. vencidos</p>
                      <p className="mt-2 font-mono text-2xl font-semibold text-red-950">
                        {alertsLoading && !alertSummary ? "..." : alertSummary?.expiredTrainings ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">Afastados</p>
                      <p className="mt-2 font-mono text-2xl font-semibold text-zinc-950">
                        {alertsLoading && !alertSummary ? "..." : alertSummary?.activeLeaves ?? 0}
                      </p>
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Documentos vencidos" description="Arquivos que exigem acao imediata.">
                {alerts ? (
                  <SummaryList
                    items={alerts.alerts.expiredDocuments}
                    render={(item: { id: string; employee: string; document: string; expirationDate: string }) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-950">{item.document}</p>
                          <p className="text-xs text-zinc-500">{item.employee}</p>
                        </div>
                        <span className="text-sm font-semibold text-red-600">{formatDate(item.expirationDate)}</span>
                      </div>
                    )}
                  />
                ) : alertsError ? (
                  <ErrorState message={alertsError} />
                ) : (
                  <DashboardBlockLoading label="Carregando documentos vencidos..." />
                )}
              </SectionCard>

              <SectionCard title="Documentos vencendo" description="Validades proximas nos proximos 30 dias.">
                {alerts ? (
                  <SummaryList
                    items={alerts.alerts.expiringDocuments}
                    render={(item: { id: string; employee: string; document: string; expirationDate: string }) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-950">{item.document}</p>
                          <p className="text-xs text-zinc-500">{item.employee}</p>
                        </div>
                        <span className="text-sm font-semibold text-orange-600">{formatDate(item.expirationDate)}</span>
                      </div>
                    )}
                  />
                ) : alertsError ? (
                  <ErrorState message={alertsError} />
                ) : (
                  <DashboardBlockLoading label="Carregando documentos a vencer..." />
                )}
              </SectionCard>

              <SectionCard title={vacationSectionTitle}>
                {alerts ? (
                  <SummaryList
                    items={alerts.alerts.periodVacations}
                    emptyTitle={vacationEmptyTitle}
                    emptyDescription={vacationEmptyDescription}
                    render={(item: { id: string; employee: string; start: string; end: string; status: string }) => {
                      const progress = getVacationProgress(item.start, item.end);

                      return (
                        <div key={item.id} className="space-y-3 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-zinc-950">{item.employee}</p>
                              <p className="text-xs text-zinc-500">
                                {formatDate(item.start)} ate {formatDate(item.end)}
                              </p>
                            </div>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {vacationStatusLabel[item.status] ?? item.status}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-zinc-500">
                              <span>{progress.label}</span>
                              <span className="font-mono text-zinc-700">{progress.percentage}%</span>
                            </div>
                            <div
                              aria-label={`Andamento das férias de ${item.employee}`}
                              aria-valuemax={100}
                              aria-valuemin={0}
                              aria-valuenow={progress.percentage}
                              className="h-2 overflow-hidden rounded-full bg-zinc-100"
                              role="progressbar"
                            >
                              <div
                                className={`h-full rounded-full transition-[width] duration-500 ease-out ${getVacationProgressBarClass(progress.percentage)}`}
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                ) : alertsError ? (
                  <ErrorState message={alertsError} />
                ) : (
                  <DashboardBlockLoading label="Carregando férias..." />
                )}
              </SectionCard>

              <SectionCard title="Afastamentos ativos">
                {alerts ? (
                  <SummaryList
                    items={alerts.alerts.activeLeaves}
                    render={(item: { id: string; employee: string; start: string; end?: string | null }) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                        <p className="text-sm font-medium text-zinc-950">{item.employee}</p>
                        <span className="text-xs text-zinc-500">
                          {formatDate(item.start)} {item.end ? `ate ${formatDate(item.end)}` : ""}
                        </span>
                      </div>
                    )}
                  />
                ) : alertsError ? (
                  <ErrorState message={alertsError} />
                ) : (
                  <DashboardBlockLoading label="Carregando afastamentos..." />
                )}
              </SectionCard>

              <SectionCard title="Treinamentos vencendo">
                {alerts ? (
                  <SummaryList
                    items={alerts.alerts.expiringTrainings}
                    render={(item: { id: string; employee: string; training: string; expirationDate: string }) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-950">{item.training}</p>
                          <p className="text-xs text-zinc-500">{item.employee}</p>
                        </div>
                        <span className="text-sm font-semibold text-orange-600">{formatDate(item.expirationDate)}</span>
                      </div>
                    )}
                  />
                ) : alertsError ? (
                  <ErrorState message={alertsError} />
                ) : (
                  <DashboardBlockLoading label="Carregando treinamentos..." />
                )}
              </SectionCard>

              <SectionCard title="Aniversariantes do mes">
                {alerts ? (
                  <SummaryList
                    items={alerts.alerts.upcomingBirthdays}
                    render={(item: { id: string; name: string; birthDate: string }) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                        <p className="text-sm font-medium text-zinc-950">{item.name}</p>
                        <span className="text-xs text-zinc-500">{formatDate(item.birthDate)}</span>
                      </div>
                    )}
                  />
                ) : alertsError ? (
                  <ErrorState message={alertsError} />
                ) : (
                  <DashboardBlockLoading label="Carregando aniversariantes..." />
                )}
              </SectionCard>
            </div>

            <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                <p>
                  Indicadores financeiros seguem as permissões sensíveis de Custos de Mão de Obra.
                </p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
