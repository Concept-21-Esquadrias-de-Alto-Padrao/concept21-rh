import type {
  CostCalculationType,
  CostComponent,
  EmployeeCostComponent,
} from "@/modules/hr/types";

export interface CostCalculationInput {
  baseSalary: number;
  monthlyHours: number;
  businessDays: number;
  component: CostComponent;
  employeeComponent?: EmployeeCostComponent | null;
  totalCompensationBase?: number;
  componentBaseAmount?: number;
}

export interface CalculatedCostComponent {
  component: CostComponent;
  employeeComponent?: EmployeeCostComponent | null;
  calculationType: CostCalculationType;
  quantity: number;
  amount: number;
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function toNumber(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundRate(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function safeDivide(total: number, divisor?: number | null) {
  if (!divisor || divisor <= 0) {
    return null;
  }

  return roundRate(total / divisor);
}

export function calculateHourlyRate(baseSalary: number, monthlyHours?: number | null) {
  return safeDivide(toNumber(baseSalary), monthlyHours);
}

export function calculateContractualHourCost(totalCost: number, contractedHours?: number | null) {
  return safeDivide(totalCost, contractedHours);
}

export function calculateWorkedHourCost(totalCost: number, workedHours?: number | null) {
  return safeDivide(totalCost, workedHours);
}

export function calculateProductiveHourCost(totalCost: number, productiveHours?: number | null) {
  return safeDivide(totalCost, productiveHours);
}

export function calculatePercentageComponent(percentage: number | null | undefined, baseValue: number) {
  return roundMoney((toNumber(baseValue) * toNumber(percentage)) / 100);
}

export function calculateDailyComponent(value: number | null | undefined, businessDays: number) {
  return roundMoney(toNumber(value) * Math.max(0, businessDays));
}

export function calculateFixedMonthlyComponent(value: number | null | undefined) {
  return roundMoney(toNumber(value));
}

function componentCategoryKey(component: CostComponent) {
  return component.category?.key ?? "";
}

export function requiresManualCostInput(component: CostComponent) {
  const key = componentCategoryKey(component);

  return component.is_employer_charge || component.is_provision || key === "encargo" || key === "provisao";
}

export function normalizeReferenceMonth(referenceMonth: string) {
  if (/^\d{4}-\d{2}$/.test(referenceMonth)) {
    return `${referenceMonth}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(referenceMonth)) {
    return `${referenceMonth.slice(0, 7)}-01`;
  }

  throw new Error("Competência inválida. Use o formato MM/AAAA.");
}

export function getReferenceMonthInputValue(referenceMonth?: string | null) {
  return referenceMonth ? referenceMonth.slice(0, 7) : getDefaultReferenceMonth().slice(0, 7);
}

export function getDefaultReferenceMonth() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return `${local.toISOString().slice(0, 7)}-01`;
}

export function getMonthBounds(referenceMonth: string) {
  const normalized = normalizeReferenceMonth(referenceMonth);
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function countBusinessDays(referenceMonth: string) {
  const { startDate, endDate } = getMonthBounds(referenceMonth);
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  let total = 0;

  while (current <= end) {
    const day = current.getUTCDay();

    if (day !== 0 && day !== 6) {
      total += 1;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return total;
}

export function isDateWithinRange(referenceMonth: string, effectiveFrom: string, effectiveUntil?: string | null) {
  const { startDate, endDate } = getMonthBounds(referenceMonth);

  return effectiveFrom <= endDate && (!effectiveUntil || effectiveUntil >= startDate);
}

export function calculateCostComponent(input: CostCalculationInput): CalculatedCostComponent {
  const { baseSalary, businessDays, component, employeeComponent, monthlyHours } = input;
  const calculationType = employeeComponent?.calculation_type ?? component.calculation_type;
  const useComponentDefaults = !employeeComponent || !requiresManualCostInput(component);
  const defaultValue = useComponentDefaults ? component.default_value : 0;
  const defaultPercentage = useComponentDefaults ? component.default_percentage : 0;
  const value = employeeComponent?.value ?? defaultValue ?? 0;
  const percentage = employeeComponent?.percentage ?? defaultPercentage ?? 0;
  const quantity =
    employeeComponent?.quantity ??
    (calculationType === "daily_value"
      ? businessDays
      : calculationType === "hourly_value"
        ? monthlyHours
        : 1);
  const totalCompensationBase = input.totalCompensationBase ?? baseSalary;
  const componentBaseAmount = input.componentBaseAmount ?? totalCompensationBase;

  const amount = (() => {
    if (calculationType === "daily_value") {
      return roundMoney(toNumber(value) * toNumber(quantity));
    }

    if (calculationType === "hourly_value") {
      return roundMoney(toNumber(value) * toNumber(quantity));
    }

    if (calculationType === "percentage_base_salary") {
      return calculatePercentageComponent(percentage, baseSalary);
    }

    if (calculationType === "percentage_total_compensation") {
      return calculatePercentageComponent(percentage, totalCompensationBase);
    }

    if (calculationType === "percentage_component") {
      return calculatePercentageComponent(percentage, componentBaseAmount);
    }

    return calculateFixedMonthlyComponent(value);
  })();

  return {
    component,
    employeeComponent,
    calculationType,
    quantity: toNumber(quantity, 1),
    amount,
  };
}

export function sumCostComponents(components: Array<{ amount: number }>) {
  return roundMoney(components.reduce((total, component) => total + component.amount, 0));
}

export function formatCurrencyBRL(value?: number | null) {
  return brlFormatter.format(toNumber(value));
}

export function formatDecimalBR(value?: number | null) {
  return numberFormatter.format(toNumber(value));
}

export function formatPercentageBR(value?: number | null) {
  return `${formatDecimalBR(value)}%`;
}

export function formatReferenceMonth(referenceMonth: string) {
  const normalized = normalizeReferenceMonth(referenceMonth);
  return `${normalized.slice(5, 7)}/${normalized.slice(0, 4)}`;
}
