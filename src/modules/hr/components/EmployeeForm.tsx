"use client";

import { Save } from "lucide-react";
import { useState } from "react";

import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import type {
  CompanyUnit,
  CostCenter,
  Department,
  Employee,
  EmployeeAddress,
  EmployeeStatus,
  EmployeeUpsertInput,
  EmploymentType,
  MaritalStatus,
  Position,
} from "@/modules/hr/types";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

interface EmployeeFormOptions {
  departments: Department[];
  positions: Position[];
  employmentTypes: EmploymentType[];
  statuses: EmployeeStatus[];
  maritalStatuses: MaritalStatus[];
  companyUnits: CompanyUnit[];
  costCenters: CostCenter[];
  managers: Array<Pick<Employee, "id" | "full_name" | "employee_number">>;
}

interface EmployeeFormProps {
  initialEmployee?: Employee | null;
  options: EmployeeFormOptions;
  onSubmit: (input: EmployeeUpsertInput) => Promise<void>;
  onCancel: () => void;
}

function getInitialEmployee(initialEmployee?: Employee | null): EmployeeUpsertInput["employee"] {
  return {
    full_name: initialEmployee?.full_name ?? "",
    cpf: initialEmployee?.cpf ?? "",
    rg: initialEmployee?.rg ?? "",
    birth_date: initialEmployee?.birth_date ?? "",
    nationality: initialEmployee?.nationality ?? "Brasileira",
    marital_status: initialEmployee?.marital_status ?? "",
    marital_status_id: initialEmployee?.marital_status_id ?? "",
    phone: initialEmployee?.phone ?? "",
    email: initialEmployee?.email ?? "",
    emergency_contact_name: initialEmployee?.emergency_contact_name ?? "",
    emergency_contact_phone: initialEmployee?.emergency_contact_phone ?? "",
    employee_number: initialEmployee?.employee_number ?? "",
    hire_date: initialEmployee?.hire_date ?? "",
    employment_type_id: initialEmployee?.employment_type_id ?? "",
    department_id: initialEmployee?.department_id ?? "",
    position_id: initialEmployee?.position_id ?? "",
    manager_employee_id: initialEmployee?.manager_employee_id ?? "",
    status_id: initialEmployee?.status_id ?? "",
    company_unit_id: initialEmployee?.company_unit_id ?? "",
    cost_center_id: initialEmployee?.cost_center_id ?? "",
    work_schedule: initialEmployee?.work_schedule ?? "",
    internal_notes: initialEmployee?.internal_notes ?? "",
    is_active: initialEmployee?.is_active ?? true,
  };
}

function getInitialAddress(initialEmployee?: Employee | null): Partial<EmployeeAddress> {
  return {
    postal_code: initialEmployee?.address?.postal_code ?? "",
    street: initialEmployee?.address?.street ?? "",
    number: initialEmployee?.address?.number ?? "",
    complement: initialEmployee?.address?.complement ?? "",
    district: initialEmployee?.address?.district ?? "",
    city: initialEmployee?.address?.city ?? "",
    state: initialEmployee?.address?.state ?? "",
  };
}

export function EmployeeForm({ initialEmployee, options, onSubmit, onCancel }: EmployeeFormProps) {
  const [employee, setEmployee] = useState(getInitialEmployee(initialEmployee));
  const [address, setAddress] = useState(getInitialAddress(initialEmployee));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateEmployeeField(key: keyof EmployeeUpsertInput["employee"], value: string | boolean) {
    setEmployee((current) => ({
      ...current,
      [key]: value === "" ? undefined : value,
    }));
  }

  function updateAddressField(key: keyof EmployeeAddress, value: string) {
    setAddress((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        employee,
        address,
      });
    } catch (submitError) {
      setError(toUserFriendlyErrorMessage(submitError, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#f97316]">
          Dados pessoais
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nome completo" required>
            <input
              className={fieldClassName}
              value={employee.full_name}
              onChange={(event) => updateEmployeeField("full_name", event.target.value)}
            />
          </FormField>
          <FormField label="CPF" required>
            <input
              className={fieldClassName}
              value={employee.cpf}
              onChange={(event) => updateEmployeeField("cpf", event.target.value)}
            />
          </FormField>
          <FormField label="RG">
            <input
              className={fieldClassName}
              value={employee.rg ?? ""}
              onChange={(event) => updateEmployeeField("rg", event.target.value)}
            />
          </FormField>
          <FormField label="Data de nascimento">
            <input
              type="date"
              className={fieldClassName}
              value={employee.birth_date ?? ""}
              onChange={(event) => updateEmployeeField("birth_date", event.target.value)}
            />
          </FormField>
          <FormField label="Estado civil">
            <select
              className={fieldClassName}
              value={employee.marital_status_id ?? ""}
              onChange={(event) => updateEmployeeField("marital_status_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {options.maritalStatuses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Telefone">
            <input
              className={fieldClassName}
              value={employee.phone ?? ""}
              onChange={(event) => updateEmployeeField("phone", event.target.value)}
            />
          </FormField>
          <FormField label="E-mail">
            <input
              type="email"
              className={fieldClassName}
              value={employee.email ?? ""}
              onChange={(event) => updateEmployeeField("email", event.target.value)}
            />
          </FormField>
          <FormField label="Contato de emergencia">
            <input
              className={fieldClassName}
              value={employee.emergency_contact_name ?? ""}
              onChange={(event) => updateEmployeeField("emergency_contact_name", event.target.value)}
            />
          </FormField>
          <FormField label="Telefone do contato">
            <input
              className={fieldClassName}
              value={employee.emergency_contact_phone ?? ""}
              onChange={(event) => updateEmployeeField("emergency_contact_phone", event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#f97316]">
          Dados profissionais
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Matrícula" required>
            <input
              className={fieldClassName}
              value={employee.employee_number}
              onChange={(event) => updateEmployeeField("employee_number", event.target.value)}
            />
          </FormField>
          <FormField label="Data de admissão" required>
            <input
              type="date"
              className={fieldClassName}
              value={employee.hire_date}
              onChange={(event) => updateEmployeeField("hire_date", event.target.value)}
            />
          </FormField>
          <FormField label="Tipo de vínculo">
            <select
              className={fieldClassName}
              value={employee.employment_type_id ?? ""}
              onChange={(event) => updateEmployeeField("employment_type_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {options.employmentTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status">
            <select
              className={fieldClassName}
              value={employee.status_id ?? ""}
              onChange={(event) => updateEmployeeField("status_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {options.statuses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Departamento">
            <select
              className={fieldClassName}
              value={employee.department_id ?? ""}
              onChange={(event) => updateEmployeeField("department_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {options.departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Cargo">
            <select
              className={fieldClassName}
              value={employee.position_id ?? ""}
              onChange={(event) => updateEmployeeField("position_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {options.positions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Gestor direto">
            <select
              className={fieldClassName}
              value={employee.manager_employee_id ?? ""}
              onChange={(event) => updateEmployeeField("manager_employee_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {options.managers
                .filter((manager) => manager.id !== initialEmployee?.id)
                .map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Unidade">
            <select
              className={fieldClassName}
              value={employee.company_unit_id ?? ""}
              onChange={(event) => updateEmployeeField("company_unit_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {options.companyUnits.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Centro de custo">
            <select
              className={fieldClassName}
              value={employee.cost_center_id ?? ""}
              onChange={(event) => updateEmployeeField("cost_center_id", event.target.value)}
            >
              <option value="">Selecione</option>
              {options.costCenters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Jornada / escala">
            <input
              className={fieldClassName}
              value={employee.work_schedule ?? ""}
              onChange={(event) => updateEmployeeField("work_schedule", event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#f97316]">
          Endereço
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="CEP">
            <input
              className={fieldClassName}
              value={address.postal_code ?? ""}
              onChange={(event) => updateAddressField("postal_code", event.target.value)}
            />
          </FormField>
          <FormField label="Rua">
            <input
              className={fieldClassName}
              value={address.street ?? ""}
              onChange={(event) => updateAddressField("street", event.target.value)}
            />
          </FormField>
          <FormField label="Número">
            <input
              className={fieldClassName}
              value={address.number ?? ""}
              onChange={(event) => updateAddressField("number", event.target.value)}
            />
          </FormField>
          <FormField label="Complemento">
            <input
              className={fieldClassName}
              value={address.complement ?? ""}
              onChange={(event) => updateAddressField("complement", event.target.value)}
            />
          </FormField>
          <FormField label="Bairro">
            <input
              className={fieldClassName}
              value={address.district ?? ""}
              onChange={(event) => updateAddressField("district", event.target.value)}
            />
          </FormField>
          <FormField label="Cidade">
            <input
              className={fieldClassName}
              value={address.city ?? ""}
              onChange={(event) => updateAddressField("city", event.target.value)}
            />
          </FormField>
          <FormField label="Estado">
            <input
              className={fieldClassName}
              value={address.state ?? ""}
              onChange={(event) => updateAddressField("state", event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <FormField label="Observacoes internas">
        <textarea
          className={`${fieldClassName} min-h-28`}
          value={employee.internal_notes ?? ""}
          onChange={(event) => updateEmployeeField("internal_notes", event.target.value)}
        />
      </FormField>

      <div className="flex justify-end gap-2 border-t border-zinc-200 pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar colaborador"}
        </button>
      </div>
    </form>
  );
}
