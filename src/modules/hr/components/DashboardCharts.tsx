import type { ReactNode } from "react";

import { EmptyState } from "@/modules/hr/components/EmptyState";

export interface ChartDatum {
  label: string;
  value: number;
  detail?: string;
  color?: string;
}

export interface GroupedChartDatum {
  label: string;
  [key: string]: string | number;
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface ChartCardShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const defaultValueFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

function formatValue(value: number, formatter?: (value: number) => string) {
  return formatter ? formatter(value) : defaultValueFormatter.format(value);
}

function hasUsefulData(data: Array<{ value: number }>) {
  return data.some((item) => Number.isFinite(item.value) && item.value > 0);
}

function ChartCardShell({ title, description, children }: ChartCardShellProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function LineChartCard({
  title,
  description,
  data,
  valueFormatter,
  color = "#f97316",
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  valueFormatter?: (value: number) => string;
  color?: string;
}) {
  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 18, bottom: 44, left: 42 };
  const values = data.map((item) => (Number.isFinite(item.value) ? item.value : 0));
  const maxValue = Math.max(1, ...values) * 1.15;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = values.map((value, index) => {
    const x = padding.left + (data.length <= 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return { x, y, value };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <ChartCardShell title={title} description={description}>
      {data.length === 0 ? (
        <EmptyState title="Sem dados para o gráfico" />
      ) : (
        <div className="overflow-hidden">
          <svg className="h-64 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight}
              x2={width - padding.right}
              y2={padding.top + chartHeight}
              stroke="#e4e4e7"
              strokeWidth="1"
            />
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + chartHeight}
              stroke="#e4e4e7"
              strokeWidth="1"
            />
            <polyline points={path} fill="none" stroke={color} strokeLinecap="round" strokeWidth="3" />
            {points.map((point, index) => (
              <g key={`${data[index]?.label}-${index}`}>
                <circle cx={point.x} cy={point.y} r="4.5" fill="#fff" stroke={color} strokeWidth="3" />
                <text
                  x={point.x}
                  y={point.y - 12}
                  textAnchor="middle"
                  className="fill-zinc-700 text-[11px] font-semibold"
                >
                  {formatValue(point.value, valueFormatter)}
                </text>
                <text
                  x={point.x}
                  y={height - 16}
                  textAnchor="middle"
                  className="fill-zinc-500 text-[11px]"
                >
                  {data[index]?.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </ChartCardShell>
  );
}

export function GroupedBarChartCard({
  title,
  description,
  data,
  series,
  valueFormatter,
}: {
  title: string;
  description?: string;
  data: GroupedChartDatum[];
  series: ChartSeries[];
  valueFormatter?: (value: number) => string;
}) {
  const width = 680;
  const height = 260;
  const padding = { top: 24, right: 18, bottom: 52, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => series.map((serie) => Number(item[serie.key]) || 0)),
  );
  const groupWidth = data.length > 0 ? chartWidth / data.length : chartWidth;
  const barWidth = Math.max(8, Math.min(28, (groupWidth - 16) / Math.max(1, series.length)));

  return (
    <ChartCardShell title={title} description={description}>
      {data.length === 0 ? (
        <EmptyState title="Sem dados para o gráfico" />
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap gap-3">
            {series.map((serie) => (
              <span key={serie.key} className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: serie.color }} />
                {serie.label}
              </span>
            ))}
          </div>
          <div className="overflow-hidden">
            <svg className="h-72 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
              <line
                x1={padding.left}
                y1={padding.top + chartHeight}
                x2={width - padding.right}
                y2={padding.top + chartHeight}
                stroke="#e4e4e7"
                strokeWidth="1"
              />
              {data.map((item, index) => {
                const groupX = padding.left + index * groupWidth + groupWidth / 2;
                return (
                  <g key={item.label}>
                    {series.map((serie, serieIndex) => {
                      const value = Number(item[serie.key]) || 0;
                      const barHeight = (value / maxValue) * chartHeight;
                      const x = groupX - ((series.length * barWidth) / 2) + serieIndex * barWidth;
                      const y = padding.top + chartHeight - barHeight;
                      return (
                        <g key={serie.key}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth - 3}
                            height={barHeight}
                            rx="3"
                            fill={serie.color}
                          />
                          {value > 0 ? (
                            <text
                              x={x + (barWidth - 3) / 2}
                              y={Math.max(12, y - 6)}
                              textAnchor="middle"
                              className="fill-zinc-700 text-[10px] font-semibold"
                            >
                              {formatValue(value, valueFormatter)}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                    <text
                      x={groupX}
                      y={height - 18}
                      textAnchor="middle"
                      className="fill-zinc-500 text-[11px]"
                    >
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </ChartCardShell>
  );
}

export function HorizontalBarChartCard({
  title,
  description,
  data,
  valueFormatter,
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  valueFormatter?: (value: number) => string;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <ChartCardShell title={title} description={description}>
      {data.length === 0 || !hasUsefulData(data) ? (
        <EmptyState title="Sem dados para o gráfico" />
      ) : (
        <div className="space-y-4">
          {data.map((item, index) => {
            const width = Math.max(3, (item.value / maxValue) * 100);
            return (
              <div key={`${item.label}-${index}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{item.label}</p>
                    {item.detail ? <p className="text-xs text-zinc-500">{item.detail}</p> : null}
                  </div>
                  <span className="font-mono text-sm font-semibold text-zinc-900">
                    {formatValue(item.value, valueFormatter)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-[#f97316]"
                    style={{
                      width: `${width}%`,
                      backgroundColor: item.color ?? "#f97316",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCardShell>
  );
}

export function DonutChartCard({
  title,
  description,
  data,
  valueFormatter,
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  valueFormatter?: (value: number) => string;
}) {
  const filteredData = data.filter((item) => item.value > 0);
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);
  const totalDisplay = formatValue(total, valueFormatter);
  const totalParts = totalDisplay.includes(" ") ? totalDisplay.split(" ") : [totalDisplay];
  const gradient = filteredData
    .reduce<{ parts: string[]; accumulated: number }>(
      (state, item) => {
        const start = (state.accumulated / total) * 100;
        const nextAccumulated = state.accumulated + item.value;
        const end = (nextAccumulated / total) * 100;

        return {
          accumulated: nextAccumulated,
          parts: [...state.parts, `${item.color ?? "#f97316"} ${start}% ${end}%`],
        };
      },
      { accumulated: 0, parts: [] },
    )
    .parts.join(", ");

  return (
    <ChartCardShell title={title} description={description}>
      {filteredData.length === 0 || total <= 0 ? (
        <EmptyState title="Sem dados de composição" />
      ) : (
        <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)] md:items-center">
          <div
            className="mx-auto grid h-48 w-48 place-items-center rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <div className="grid h-32 w-32 place-items-center rounded-full bg-white px-2 text-center shadow-sm">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-zinc-500">Total</p>
                {totalParts.length > 1 ? (
                  <p className="mt-1 font-mono font-semibold leading-tight text-zinc-950">
                    <span className="block text-xs">{totalParts[0]}</span>
                    <span className="block text-sm">{totalParts.slice(1).join(" ")}</span>
                  </p>
                ) : (
                  <p className="mt-1 break-words font-mono text-sm font-semibold leading-tight text-zinc-950">
                    {totalDisplay}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {filteredData.map((item) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm text-zinc-700">
                    <span
                      className="h-2.5 w-2.5 flex-none rounded-full"
                      style={{ backgroundColor: item.color ?? "#f97316" }}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-sm font-semibold text-zinc-900">
                    {defaultValueFormatter.format(percentage)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ChartCardShell>
  );
}

export function RankingTableCard({
  title,
  description,
  data,
  valueFormatter,
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  valueFormatter?: (value: number) => string;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <ChartCardShell title={title} description={description}>
      {data.length === 0 ? (
        <EmptyState title="Sem dados para o ranking" />
      ) : (
        <div className="divide-y divide-zinc-100">
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`} className="grid gap-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-950">
                    {index + 1}. {item.label}
                  </p>
                  {item.detail ? <p className="text-xs text-zinc-500">{item.detail}</p> : null}
                </div>
                <span className="font-mono text-sm font-semibold text-zinc-900">
                  {formatValue(item.value, valueFormatter)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-[#171a1f]"
                  style={{ width: `${Math.max(3, (item.value / maxValue) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCardShell>
  );
}
