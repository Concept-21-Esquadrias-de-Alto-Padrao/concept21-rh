import type { ReactNode } from "react";

export interface FilterBarProps {
  children: ReactNode;
  columnsClassName?: string;
}

export function FilterBar({
  children,
  columnsClassName = "grid gap-3 md:grid-cols-2 xl:grid-cols-5",
}: FilterBarProps) {
  return (
    <div className="mb-4 rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className={columnsClassName}>{children}</div>
    </div>
  );
}

