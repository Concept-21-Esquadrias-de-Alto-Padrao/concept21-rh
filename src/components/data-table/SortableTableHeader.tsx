"use client";

import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";

export type SortDirection = "asc" | "desc";

interface SortableTableHeaderProps<TSort extends string> {
  label: string;
  sortKey: TSort;
  activeSort?: TSort;
  direction?: SortDirection;
  onSort: (sortKey: TSort) => void;
}

export function SortableTableHeader<TSort extends string>({
  label,
  sortKey,
  activeSort,
  direction = "asc",
  onSort,
}: SortableTableHeaderProps<TSort>) {
  const active = activeSort === sortKey;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowDownUp;
  const nextDirection = active && direction === "asc" ? "descendente" : "ascendente";

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-orange-100 ${
        active ? "text-[#f97316]" : "text-zinc-500 hover:text-zinc-900"
      }`}
      onClick={() => onSort(sortKey)}
      title={`Ordenar por ${label}`}
      aria-label={`Ordenar por ${label} em ordem ${nextDirection}`}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
