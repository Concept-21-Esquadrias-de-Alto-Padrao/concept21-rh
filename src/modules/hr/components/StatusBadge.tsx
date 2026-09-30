import { statusTone } from "@/modules/hr/utils/status";

const toneClasses = {
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-orange-200 bg-orange-50 text-orange-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

interface StatusBadgeProps {
  label?: string | null;
  status?: string | null;
}

export function StatusBadge({ label, status }: StatusBadgeProps) {
  const tone = statusTone(status ?? label);

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {label ?? status ?? "-"}
    </span>
  );
}
