"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTablePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPaginationItems(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);

  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = Array.from(pages)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((first, second) => first - second);
  const items: Array<number | "ellipsis"> = [];

  sorted.forEach((item) => {
    const previous = items.at(-1);

    if (typeof previous === "number" && item - previous > 1) {
      items.push("ellipsis");
    }

    items.push(item);
  });

  return items;
}

export function DataTablePagination({
  page,
  totalPages,
  onPageChange,
}: DataTablePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const items = getPaginationItems(page, totalPages);

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação da tabela">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:border-[#f97316] hover:text-[#f97316] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Anterior</span>
      </button>

      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-zinc-400">
            ...
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Ir para página ${item}`}
            className={`grid h-9 min-w-9 place-items-center rounded-md border px-2 text-sm font-semibold transition ${
              item === page
                ? "border-[#f97316] bg-orange-50 text-[#f97316]"
                : "border-zinc-300 text-zinc-700 hover:border-[#f97316] hover:text-[#f97316]"
            }`}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:border-[#f97316] hover:text-[#f97316] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Próxima página"
      >
        <span className="hidden sm:inline">Próxima</span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
