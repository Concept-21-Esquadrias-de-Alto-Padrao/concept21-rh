"use client";

import { filterFieldClassName } from "@/components/filters/filterStyles";

export interface NumberFilterProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function NumberFilter({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  disabled = false,
}: NumberFilterProps) {
  return (
    <div>
      {label ? <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label> : null}
      <input
        type="number"
        className={filterFieldClassName}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

