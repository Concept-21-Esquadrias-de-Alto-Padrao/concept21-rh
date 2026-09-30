"use client";

import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import { AuditTimeline } from "@/modules/hr/components/AuditTimeline";
import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmployeeDependentsPanel } from "@/modules/hr/components/EmployeeDependentsPanel";
import { EmployeeLaborCostsPanel } from "@/modules/hr/components/EmployeeLaborCostsPanel";
import { EmployeeMovementsPanel } from "@/modules/hr/components/EmployeeMovementsPanel";
import { EmployeeForm } from "@/modules/hr/components/EmployeeForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { ErrorState } from "@/modules/hr/components/ErrorState";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { SectionCard } from "@/modules/hr/components/SectionCard";
import { SignedDocumentLink } from "@/modules/hr/components/SignedDocumentLink";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import { Tabs } from "@/modules/hr/components/Tabs";
import { useAsyncResource } from "@/modules/hr/hooks/useAsyncResource";
import { listAuditLogs, listEmployeeHistory } from "@/modules/hr/services/audit.service";
import { getCurrentUserAccess, hasMasterRole } from "@/modules/hr/services/auth.service";
import { listEmployeeDependents } from "@/modules/hr/services/dependents.service";
import { listEmployeeDocuments } from "@/modules/hr/services/documents.service";
import {
  getEmployeeById,
  listEmployees,
  updateEmployee,
} from "@/modules/hr/services/employees.service";
import {
  listEmployeeMovementCostCategories,
  listEmployeeMovements,
} from "@/modules/hr/services/movements.service";
import { listOccurrences } from "@/modules/hr/services/occurrences.service";
import { checkUserPermission } from "@/modules/hr/services/permissions.service";
import { listSettingItems } from "@/modules/hr/services/settings.service";
import { listEmployeeTrainings } from "@/modules/hr/services/trainings.service";
import { listLeaves, listVacations } from "@/modules/hr/services/vacations.service";
import type {
  AuditLog,
  CompanyUnit,
  CostCenter,
  DependentRelationshipType,
  Department,
  Employee,
  EmployeeMovementCostCategory,
  EmployeeDependent,
  EmployeeDocument,
  EmployeeHistoryEvent,
  EmployeeLeave,
  EmployeeMovement,
  EmployeeOccurrence,
  EmployeeStatus,
  EmployeeTraining,
  EmploymentType,
  MaritalStatus,
  Position,
  TerminationReason,
  Vacation,
} from "@/modules/hr/types";
import { formatCpf, formatDate, formatDateTime } from "@/modules/hr/utils/format";
import {
  documentStatusLabels,
  occurrenceStatusLabels,
  trainingStatusLabels,
  workflowStatusLabels,
} from "@/modules/hr/utils/status";

interface EmployeeProfileData {
  employee: Employee;
  documents: EmployeeDocument[];
  dependents: EmployeeDependent[];
  vacations: Vacation[];
  leaves: EmployeeLeave[];
  trainings: EmployeeTraining[];
  occurrences: EmployeeOccurrence[];
  movements: EmployeeMovement[];
  history: EmployeeHistoryEvent[];
  auditLogs: AuditLog[];
  departments: Department[];
  positions: Position[];
  employmentTypes: EmploymentType[];
  maritalStatuses: MaritalStatus[];
  relationshipTypes: DependentRelationshipType[];
  statuses: EmployeeStatus[];
  companyUnits: CompanyUnit[];
  costCenters: CostCenter[];
  managers: Employee[];
  terminationReasons: TerminationReason[];
  movementCostCategories: EmployeeMovementCostCategory[];
  isMaster: boolean;
  canManageMovements: boolean;
}

async function loadEmployeeProfileData(employeeId: string): Promise<EmployeeProfileData> {
  const [
    employee,
    documents,
    dependents,
    vacations,
    leaves,
    trainings,
    occurrences,
    movements,
    history,
    auditLogs,
    departments,
    positions,
    employmentTypes,
    maritalStatuses,
    relationshipTypes,
    statuses,
    companyUnits,
    costCenters,
    managers,
    terminationReasons,
    movementCostCategories,
    canManageMovements,
    currentUserAccess,
  ] = await Promise.all([
    getEmployeeById(employeeId),
    listEmployeeDocuments(employeeId),
    listEmployeeDependents(employeeId),
    listVacations(employeeId),
    listLeaves(employeeId),
    listEmployeeTrainings(employeeId),
    listOccurrences(employeeId),
    listEmployeeMovements({ employeeId }),
    listEmployeeHistory(employeeId),
    listAuditLogs(100),
    listSettingItems("departments"),
    listSettingItems("positions"),
    listSettingItems("employment_types"),
    listSettingItems("marital_statuses"),
    listSettingItems("dependent_relationship_types"),
    listSettingItems("employee_statuses"),
    listSettingItems("company_units"),
    listSettingItems("cost_centers"),
    listEmployees({}),
    listSettingItems("termination_reasons"),
    listEmployeeMovementCostCategories({ includeInactive: true }),
    checkUserPermission("hr.movements.manage"),
    getCurrentUserAccess(),
  ]);

  return {
    employee,
    documents,
    dependents,
    vacations,
    leaves,
    trainings,
    occurrences,
    movements,
    history,
    auditLogs: auditLogs.filter((log) => log.entity_id === employeeId),
    departments: departments as Department[],
    positions: positions as Position[],
    employmentTypes: employmentTypes as EmploymentType[],
    maritalStatuses: maritalStatuses as MaritalStatus[],
    relationshipTypes: relationshipTypes as DependentRelationshipType[],
    statuses: statuses as EmployeeStatus[],
    companyUnits: companyUnits as CompanyUnit[],
    costCenters: costCenters as CostCenter[],
    managers,
    terminationReasons: terminationReasons as TerminationReason[],
    movementCostCategories,
    isMaster: hasMasterRole(currentUserAccess),
    canManageMovements,
  };
}

function DetailGrid({ items }: { items: Array<{ label: string; value?: string | null }> }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
          <dt className="text-xs font-medium uppercase tracking-[0.1em] text-zinc-500">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-zinc-950">{item.value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmployeeProfilePage({ employeeId }: { employeeId: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, loading, error, reload } = useAsyncResource(
    () => loadEmployeeProfileData(employeeId),
    employeeId,
  );

  const documentColumns = useMemo<Array<DataTableColumn<EmployeeDocument>>>(
    () => [
      {
        key: "type",
        header: "Documento",
        render: (document) => document.document_type?.name ?? "-",
      },
      {
        key: "validity",
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
        render: (document) => <SignedDocumentLink document={document} />,
      },
    ],
    [],
  );

  const vacationColumns = useMemo<Array<DataTableColumn<Vacation>>>(
    () => [
      { key: "period", header: "Período", render: (item) => `${formatDate(item.vacation_start)} até ${formatDate(item.vacation_end)}` },
      { key: "days", header: "Dias", render: (item) => item.days_count },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={workflowStatusLabels[item.status]} status={item.status} />,
      },
    ],
    [],
  );

  const leaveColumns = useMemo<Array<DataTableColumn<EmployeeLeave>>>(
    () => [
      { key: "type", header: "Tipo", render: (item) => item.leave_type?.name ?? "-" },
      { key: "period", header: "Período", render: (item) => `${formatDate(item.start_date)} ${item.end_date ? `até ${formatDate(item.end_date)}` : ""}` },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={workflowStatusLabels[item.status]} status={item.status} />,
      },
    ],
    [],
  );

  const trainingColumns = useMemo<Array<DataTableColumn<EmployeeTraining>>>(
    () => [
      { key: "training", header: "Treinamento", render: (item) => item.training?.name ?? "-" },
      { key: "completion", header: "Conclusão", render: (item) => formatDate(item.completion_date) },
      { key: "validity", header: "Validade", render: (item) => formatDate(item.expiration_date) },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={trainingStatusLabels[item.status]} status={item.status} />,
      },
    ],
    [],
  );

  const occurrenceColumns = useMemo<Array<DataTableColumn<EmployeeOccurrence>>>(
    () => [
      { key: "title", header: "Titulo", render: (item) => item.title },
      { key: "type", header: "Tipo", render: (item) => item.occurrence_type?.name ?? "-" },
      { key: "date", header: "Data", render: (item) => formatDateTime(item.occurred_at) },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge label={occurrenceStatusLabels[item.status]} status={item.status} />,
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Perfil do colaborador"
        title={data?.employee.full_name ?? "Colaborador"}
        description="Prontuário digital organizado por abas, com eventos históricos e auditoria."
        actions={
          data ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
            >
              <Pencil className="h-4 w-4" />
              Editar cadastro
            </button>
          ) : null
        }
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <>
          <Tabs
            tabs={[
              {
                id: "personal",
                label: "Dados pessoais",
                content: (
                  <SectionCard title="Dados pessoais">
                    <DetailGrid
                      items={[
                        { label: "Nome", value: data.employee.full_name },
                        { label: "CPF", value: formatCpf(data.employee.cpf) },
                        { label: "RG", value: data.employee.rg },
                        { label: "Nascimento", value: formatDate(data.employee.birth_date) },
                        { label: "Estado civil", value: data.employee.marital_status_record?.name ?? data.employee.marital_status },
                        { label: "Telefone", value: data.employee.phone },
                        { label: "E-mail", value: data.employee.email },
                        { label: "Contato de emergencia", value: data.employee.emergency_contact_name },
                        { label: "Telefone emergencia", value: data.employee.emergency_contact_phone },
                      ]}
                    />
                  </SectionCard>
                ),
              },
              {
                id: "professional",
                label: "Dados profissionais",
                content: (
                  <SectionCard title="Dados profissionais">
                    <DetailGrid
                      items={[
                        { label: "Matrícula", value: data.employee.employee_number },
                        { label: "Admissão", value: formatDate(data.employee.hire_date) },
                        { label: "Status", value: data.employee.status?.name },
                        { label: "Tipo de vínculo", value: data.employee.employment_type?.name },
                        { label: "Departamento", value: data.employee.department?.name },
                        { label: "Cargo", value: data.employee.position?.name },
                        { label: "Gestor", value: data.employee.manager?.full_name },
                        { label: "Unidade", value: data.employee.company_unit?.name },
                        { label: "Centro de custo", value: data.employee.cost_center?.name },
                        { label: "Jornada", value: data.employee.work_schedule },
                      ]}
                    />
                  </SectionCard>
                ),
              },
              {
                id: "movements",
                label: "Admissoes e desligamentos",
                content: (
                  <SectionCard title="Admissoes e desligamentos">
                    <EmployeeMovementsPanel
                      movements={data.movements}
                      employees={data.managers}
                      terminationReasons={data.terminationReasons}
                      movementCostCategories={data.movementCostCategories}
                      employeeId={data.employee.id}
                      canManage={data.canManageMovements}
                      showEmployeeColumn={false}
                      onChanged={reload}
                    />
                  </SectionCard>
                ),
              },
              {
                id: "dependents",
                label: "Dependentes",
                content: (
                  <SectionCard title="Dependentes">
                    <EmployeeDependentsPanel
                      employeeId={data.employee.id}
                      dependents={data.dependents}
                      relationshipTypes={data.relationshipTypes}
                      canDelete={data.isMaster}
                      onChanged={reload}
                    />
                  </SectionCard>
                ),
              },
              {
                id: "documents",
                label: "Documentos",
                content: (
                  <SectionCard title="Documentos">
                    <DataTable
                      data={data.documents}
                      columns={documentColumns}
                      getRowKey={(item) => item.id}
                      emptyState={<EmptyState title="Nenhum documento vinculado" />}
                    />
                  </SectionCard>
                ),
              },
              {
                id: "timeoff",
                label: "Férias e afastamentos",
                content: (
                  <div className="space-y-4">
                    <SectionCard title="Férias">
                      <DataTable
                        data={data.vacations}
                        columns={vacationColumns}
                        getRowKey={(item) => item.id}
                        emptyState={<EmptyState title="Nenhuma feria registrada" />}
                      />
                    </SectionCard>
                    <SectionCard title="Afastamentos">
                      <DataTable
                        data={data.leaves}
                        columns={leaveColumns}
                        getRowKey={(item) => item.id}
                        emptyState={<EmptyState title="Nenhum afastamento registrado" />}
                      />
                    </SectionCard>
                  </div>
                ),
              },
              {
                id: "trainings",
                label: "Treinamentos",
                content: (
                  <SectionCard title="Treinamentos">
                    <DataTable
                      data={data.trainings}
                      columns={trainingColumns}
                      getRowKey={(item) => item.id}
                      emptyState={<EmptyState title="Nenhum treinamento vinculado" />}
                    />
                  </SectionCard>
                ),
              },
              {
                id: "occurrences",
                label: "Ocorrências",
                content: (
                  <SectionCard title="Ocorrências">
                    <DataTable
                      data={data.occurrences}
                      columns={occurrenceColumns}
                      getRowKey={(item) => item.id}
                      emptyState={<EmptyState title="Nenhuma ocorrência registrada" />}
                    />
                  </SectionCard>
                ),
              },
              {
                id: "costs",
                label: "Custos",
                content: <EmployeeLaborCostsPanel employee={data.employee} canDelete={data.isMaster} />,
              },
              {
                id: "history",
                label: "Histórico",
                content: (
                  <SectionCard title="Histórico cronológico">
                    <AuditTimeline items={data.history} type="history" />
                  </SectionCard>
                ),
              },
              {
                id: "audit",
                label: "Auditoria",
                content: (
                  <SectionCard title="Auditoria">
                    <AuditTimeline items={data.auditLogs} type="audit" />
                  </SectionCard>
                ),
              },
            ]}
          />

          <DrawerForm
            open={drawerOpen}
            title="Editar colaborador"
            description="Atualize o cadastro principal mantendo histórico e auditoria."
            onClose={() => setDrawerOpen(false)}
          >
            <EmployeeForm
              initialEmployee={data.employee}
              options={{
                departments: data.departments,
                positions: data.positions,
                employmentTypes: data.employmentTypes,
                statuses: data.statuses,
                maritalStatuses: data.maritalStatuses,
                companyUnits: data.companyUnits,
                costCenters: data.costCenters,
                managers: data.managers,
              }}
              onCancel={() => setDrawerOpen(false)}
              onSubmit={async (input) => {
                await updateEmployee(data.employee.id, input);
                setDrawerOpen(false);
                await reload();
              }}
            />
          </DrawerForm>
        </>
      ) : null}
    </div>
  );
}
