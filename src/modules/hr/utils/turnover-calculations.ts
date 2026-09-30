export interface TurnoverThresholds {
  lowMax: number;
  moderateMax: number;
}

export type TurnoverStatus = "low" | "moderate" | "high";

export const DEFAULT_TURNOVER_THRESHOLDS: TurnoverThresholds = {
  lowMax: 3,
  moderateMax: 7,
};

function roundTurnover(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateAverageHeadcount(activeAtStart: number, activeAtEnd: number) {
  const start = Number.isFinite(activeAtStart) ? Math.max(0, activeAtStart) : 0;
  const end = Number.isFinite(activeAtEnd) ? Math.max(0, activeAtEnd) : 0;
  return roundTurnover((start + end) / 2);
}

export function calculateTurnoverRate(
  admissions: number,
  terminations: number,
  averageHeadcount?: number | null,
) {
  if (!averageHeadcount || averageHeadcount <= 0) {
    return 0;
  }

  return roundTurnover((((Math.max(0, admissions) + Math.max(0, terminations)) / 2) / averageHeadcount) * 100);
}

export function calculateTerminationTurnoverRate(
  terminations: number,
  averageHeadcount?: number | null,
) {
  if (!averageHeadcount || averageHeadcount <= 0) {
    return 0;
  }

  return roundTurnover((Math.max(0, terminations) / averageHeadcount) * 100);
}

export function getTurnoverStatus(
  value: number,
  thresholds: TurnoverThresholds = DEFAULT_TURNOVER_THRESHOLDS,
): TurnoverStatus {
  if (value <= thresholds.lowMax) {
    return "low";
  }

  if (value <= thresholds.moderateMax) {
    return "moderate";
  }

  return "high";
}

export function formatTurnoverPercentage(value?: number | null) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;

  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(numeric)}%`;
}
