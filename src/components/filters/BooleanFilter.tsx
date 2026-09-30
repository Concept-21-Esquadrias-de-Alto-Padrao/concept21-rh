"use client";

import { filterFieldClassName } from "@/components/filters/filterStyles";

export type BooleanFilterValue = "" | "true" | "false";

export interface BooleanFilterProps {
  label?: string;
  value: BooleanFilterValue;
  onChange: (value: BooleanFilterValue) => void;
  trueLabel?: string;
  falseLabel?: string;
  allLabel?: string;
  disabled?: boolean;
}

export function BooleanFilter({
  label,
  value,
  onChange,
  trueLabel = "Sim",
  falseLabel = "Não",
  allLabel = "Todos",
  disabled = false,
}: BooleanFilterProps) {
  return (
    <div>
      {label ? <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label> : null}
      <select
        className={filterFieldClassName}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as BooleanFilterValue)}
      >
        <option value="">{allLabel}</option>
        <option value="true">{trueLabel}</option>
        <option value="false">{falseLabel}</option>
      </select>
    </div>
  );
}

