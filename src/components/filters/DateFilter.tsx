"use client";

import { filterFieldClassName } from "@/components/filters/filterStyles";

export interface DateFilterProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DateFilter({ label, value, onChange, disabled = false }: DateFilterProps) {
  return (
    <div>
      {label ? <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label> : null}
      <input
        type="date"
        className={filterFieldClassName}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

