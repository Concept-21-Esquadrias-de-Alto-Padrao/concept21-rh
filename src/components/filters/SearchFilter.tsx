"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

import { filterFieldClassName } from "@/components/filters/filterStyles";

export interface SearchFilterProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  debounceMs?: number;
}

export function SearchFilter({
  label,
  value,
  onChange,
  placeholder = "Buscar",
  disabled = false,
  debounceMs = 0,
}: SearchFilterProps) {
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function emitChange(nextValue: string) {
    if (debounceMs <= 0) {
      onChange(nextValue);
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => onChange(nextValue), debounceMs);
  }

  return (
    <div>
      {label ? <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label> : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <input
          key={debounceMs > 0 ? value : undefined}
          className={`${filterFieldClassName} pl-9`}
          {...(debounceMs > 0 ? { defaultValue: value } : { value })}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => emitChange(event.target.value)}
        />
      </div>
    </div>
  );
}

