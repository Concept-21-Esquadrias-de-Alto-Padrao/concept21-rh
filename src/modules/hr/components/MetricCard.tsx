import type { LucideIcon } from "lucide-react";

const toneClasses = {
  neutral: "border-zinc-200 bg-white text-zinc-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-orange-200 bg-orange-50 text-orange-950",
  danger: "border-red-200 bg-red-50 text-red-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

interface MetricCardProps {
  label: string;
  value: number | string;
  tone?: keyof typeof toneClasses;
  icon?: LucideIcon;
  detail?: string;
  badge?: string;
}

export function MetricCard({ label, value, tone = "neutral", icon: Icon, detail, badge }: MetricCardProps) {
  return (
    <div className={`rounded-md border p-4 shadow-sm ${toneClasses[tone]}`}>
      <div className="relative min-h-36">
        <div className="min-w-0">
          <p className="pr-12 text-xs font-medium uppercase tracking-[0.12em] opacity-70">{label}</p>
          <p className="mt-3 whitespace-normal break-words font-mono text-2xl font-semibold leading-tight tracking-normal">
            {value}
          </p>
          {detail ? <p className="mt-2 text-sm font-medium opacity-80">{detail}</p> : null}
          {badge ? (
            <span className="mt-3 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]">
              {badge}
            </span>
          ) : null}
        </div>
        {Icon ? (
          <div className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-md bg-white/70">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
