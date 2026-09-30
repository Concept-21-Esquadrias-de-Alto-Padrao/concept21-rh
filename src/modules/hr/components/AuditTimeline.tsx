import { Clock3 } from "lucide-react";

import type { AuditLog, EmployeeHistoryEvent } from "@/modules/hr/types";
import { formatDateTime } from "@/modules/hr/utils/format";

interface AuditTimelineProps {
  items: Array<AuditLog | EmployeeHistoryEvent>;
  type?: "audit" | "history";
}

export function AuditTimeline({ items, type = "history" }: AuditTimelineProps) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhum evento registrado.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const title = type === "audit" ? (item as AuditLog).action : (item as EmployeeHistoryEvent).title;
        const date = type === "audit" ? item.created_at : (item as EmployeeHistoryEvent).event_date;
        const description =
          type === "audit"
            ? `${(item as AuditLog).entity}${(item as AuditLog).entity_id ? ` / ${(item as AuditLog).entity_id}` : ""}`
            : (item as EmployeeHistoryEvent).description;

        return (
          <div key={item.id} className="flex gap-3">
            <div className="mt-1 grid h-8 w-8 flex-none place-items-center rounded-full bg-orange-50 text-[#f97316]">
              <Clock3 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 border-b border-zinc-100 pb-4">
              <p className="text-sm font-semibold text-zinc-950">{title}</p>
              {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
              <p className="mt-2 font-mono text-xs text-zinc-400">{formatDateTime(date)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
