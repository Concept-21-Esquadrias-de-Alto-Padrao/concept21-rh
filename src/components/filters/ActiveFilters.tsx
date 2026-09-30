"use client";

import { X } from "lucide-react";

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove?: () => void;
}

export interface ActiveFiltersProps {
  filters: ActiveFilterChip[];
  onClearAll?: () => void;
  clearLabel?: string;
}

export function ActiveFilters({
  filters,
  onClearAll,
  clearLabel = "Limpar filtros",
}: ActiveFiltersProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-zinc-600">Filtros aplicados:</span>
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-900 transition hover:border-[#f97316]"
          onClick={filter.onRemove}
          disabled={!filter.onRemove}
          title={filter.label}
        >
          <span className="truncate">{filter.label}</span>
          {filter.onRemove ? <X className="h-3 w-3 shrink-0" /> : null}
        </button>
      ))}
      {onClearAll ? (
        <button
          type="button"
          className="text-xs font-semibold text-[#f97316] transition hover:text-[#ea580c]"
          onClick={onClearAll}
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

