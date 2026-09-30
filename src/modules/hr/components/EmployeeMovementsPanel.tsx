"use client";

import { Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/modules/hr/components/DataTable";
import { DrawerForm } from "@/modules/hr/components/DrawerForm";
import { EmployeeMovementForm } from "@/modules/hr/components/EmployeeMovementForm";
import { EmptyState } from "@/modules/hr/components/EmptyState";
import { StatusBadge } from "@/modules/hr/components/StatusBadge";
import {
  createEmployeeMovement,
  updateEmployeeMovement,
  type EmployeeMovementInput,
} from "@/modules/hr/services/movements.service";
import type {
  Department,
  Employee,
  EmployeeStatus,
  EmployeeMovement,
  EmployeeMovementCostCategory,
  EmploymentType,
  Position,
  TerminationReason,
} from "@/modules/hr/types";
import { formatDate } from "@/modules/hr/utils/format";
import { formatCurrencyBRL } from "@/modules/hr/utils/labor-cost-calculations";

interface EmployeeMovementsPanelProps {
  movements: EmployeeMovement[];
  employees: Employee[];
  departments?: Department[];
  positions?: Position[];
  employmentTypes?: EmploymentType[];
  statuses?: EmployeeStatus[];
  terminationReasons: TerminationReason[];
  movementCostCategories: EmployeeMovementCostCategory[];
  employeeId?: string;
  canManage?: boolean;
  showEmployeeColumn?: boolean;
  onChanged: () => Promise<void> | void;
}

const movementTypeLabels: Record<EmployeeMovement["movement_type"], string> = {
  admission: "Admissão",
  termination: "Desligamento",
};

const movementStatusLabels: Record<EmployeeMovement["status"], string> = {
  planned: "Planejado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function getMovementDrawerTitle(movement?: EmployeeMovement | null) {
  if (!movement) {
    return "Novo movimento";
  }

  return `Editar ${movementTypeLabels[movement.movement_type].toLowerCase()}`;
}

export function EmployeeMovementsPanel({
  movements,
  employees,
  departments = [],
  positions = [],
  employmentTypes = [],
  statuses = [],
  terminationReasons,
  movementCostCategories,
  employeeId,
  canManage = true,
  showEmployeeColumn = true,
  onChanged,
}: EmployeeMovementsPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<EmployeeMovement | null>(null);
  const employeeOptions = useMemo(
    () => (employeeId ? employees.filter((employee) => employee.id === employeeId) : employees),
    [employeeId, employees],
  );

  const columns = useMemo<Array<DataTableColumn<EmployeeMovement>>>(() => {
    const baseColumns: Array<DataTableColumn<EmployeeMovement>> = [
      {
        key: "type",
        header: "Tipo",
        render: (movement) => (
          <StatusBadge
            label={movementTypeLabels[movement.movement_type]}
            status={movement.movement_type === "admission" ? "blue" : "orange"}
          />
        ),
      },
      {
        key: "date",
        header: "Data",
        render: (movement) => formatDate(movement.movement_date),
      },
      {
        key: "reason",
        header: "Motivo / detalhe",
        render: (movement) => (
          <div>
            <p className="text-sm text-zinc-800">{movement.termination_reason?.name ?? movement.notes ?? "-"}</p>
            <p className="text-xs text-zinc-500">
              {movement.cost_items?.length ? `${movement.cost_items.length} itens de custo` : "Sem itens de custo"}
            </p>
          </div>
        ),
      },
      {
        key: "total",
        header: "Total",
        className: "text-right",
        render: (movement) => (
          <span className="font-mono font-semibold text-zinc-950">{formatCurrencyBRL(movement.total_amount)}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (movement) => (
          <StatusBadge label={movementStatusLabels[movement.status]} status={movement.status} />
        ),
      },
    ];

    if (showEmployeeColumn) {
      baseColumns.unshift({
        key: "employee",
        header: "Colaborador",
        render: (movement) => (
          <div>
            <p className="font-medium text-zinc-950">{movement.employee?.full_name ?? "-"}</p>
            <p className="font-mono text-xs text-zinc-500">{movement.employee?.employee_number ?? "-"}</p>
          </div>
        ),
      });
    }

    if (canManage) {
      baseColumns.push({
        key: "actions",
        header: "Ações",
        render: (movement) => (
          <button
            type="button"
            onClick={() => {
              setEditingMovement(movement);
              setDrawerOpen(true);
            }}
            className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-[#f97316] hover:text-[#f97316]"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
        ),
      });
    }

    return baseColumns;
  }, [canManage, showEmployeeColumn]);

  async function submitMovement(input: EmployeeMovementInput) {
    if (editingMovement) {
      await updateEmployeeMovement(editingMovement.id, input);
    } else {
      await createEmployeeMovement(input);
    }

    setDrawerOpen(false);
    setEditingMovement(null);
    await onChanged();
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditingMovement(null);
              setDrawerOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
          >
            <Plus className="h-4 w-4" />
            Novo movimento
          </button>
        </div>
      ) : null}

      <DataTable
        data={movements}
        columns={columns}
        getRowKey={(movement) => movement.id}
        emptyState={
          <EmptyState
            title="Nenhum movimento registrado"
            description="Admissões e desligamentos com custos associados aparecem aqui."
          />
        }
      />

      <DrawerForm
        open={drawerOpen}
        title={getMovementDrawerTitle(editingMovement)}
        description="Registre a data, status e os valores reais informados pela contabilidade."
        onClose={() => {
          setDrawerOpen(false);
          setEditingMovement(null);
        }}
      >
        <EmployeeMovementForm
          initialMovement={editingMovement}
          employees={employeeOptions}
          departments={departments}
          positions={positions}
          employmentTypes={employmentTypes}
          statuses={statuses}
          terminationReasons={terminationReasons}
          movementCostCategories={movementCostCategories}
          lockedEmployeeId={employeeId}
          onSubmit={submitMovement}
          onCancel={() => {
            setDrawerOpen(false);
            setEditingMovement(null);
          }}
        />
      </DrawerForm>
    </div>
  );
}
