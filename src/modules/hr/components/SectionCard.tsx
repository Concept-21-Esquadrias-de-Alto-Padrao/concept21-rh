import type { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, description, actions, children }: SectionCardProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white shadow-sm">
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h3 className="text-base font-semibold text-zinc-950">{title}</h3> : null}
            {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
