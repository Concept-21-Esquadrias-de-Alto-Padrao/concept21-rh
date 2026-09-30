import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export function EmptyState({ title, description, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="grid min-h-48 place-items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-white text-[#f97316] shadow-sm">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-zinc-900">{title}</h3>
        {description ? <p className="mt-2 max-w-md text-sm text-zinc-500">{description}</p> : null}
      </div>
    </div>
  );
}
