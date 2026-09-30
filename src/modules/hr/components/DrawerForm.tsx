"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

interface DrawerFormProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export function DrawerForm({ open, title, description, children, onClose }: DrawerFormProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Fechar painel"
        className="absolute inset-0 h-full w-full bg-black/40"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
            {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-orange-200 hover:text-[#f97316]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </aside>
    </div>
  );
}
