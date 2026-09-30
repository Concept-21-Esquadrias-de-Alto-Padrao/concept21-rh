"use client";

interface DataTablePageSizeProps {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  label?: string;
}

export function DataTablePageSize({
  value,
  options,
  onChange,
  label = "Registros por página",
}: DataTablePageSizeProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      <span>{label}</span>
      <select
        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm font-medium text-zinc-800 outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
