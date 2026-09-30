"use client";

import { NumberFilter } from "@/components/filters/NumberFilter";

export interface NumberRangeFilterProps {
  minLabel?: string;
  maxLabel?: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  disabled?: boolean;
}

export function NumberRangeFilter({
  minLabel = "Valor mínimo",
  maxLabel = "Valor máximo",
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  disabled = false,
}: NumberRangeFilterProps) {
  return (
    <>
      <NumberFilter label={minLabel} value={minValue} onChange={onMinChange} disabled={disabled} />
      <NumberFilter label={maxLabel} value={maxValue} onChange={onMaxChange} disabled={disabled} />
    </>
  );
}

