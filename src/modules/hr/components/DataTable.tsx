import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (item: T) => ReactNode;
  className?: string;
  ariaSort?: "ascending" | "descending" | "none";
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  getRowKey: (item: T) => string;
  emptyState?: ReactNode;
}

export function DataTable<T>({ columns, data, getRowKey, emptyState }: DataTableProps<T>) {
  if (data.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500 ${column.className ?? ""}`}
                aria-sort={column.ariaSort}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {data.map((item) => (
            <tr key={getRowKey(item)} className="transition hover:bg-orange-50/40">
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 align-middle ${column.className ?? ""}`}>
                  {column.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
