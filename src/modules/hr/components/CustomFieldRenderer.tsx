"use client";

import type { CustomField, JsonValue } from "@/modules/hr/types";

interface CustomFieldRendererProps {
  field: CustomField;
  value?: JsonValue;
  onChange: (value: JsonValue) => void;
}

export function CustomFieldRenderer({ field, value, onChange }: CustomFieldRendererProps) {
  const commonClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

  if (field.field_type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-[#f97316]"
        />
        {field.label}
      </label>
    );
  }

  if (field.field_type === "select") {
    return (
      <label className="block text-sm font-medium text-zinc-700">
        {field.label}
        <select
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className={`${commonClass} mt-1`}
        >
          <option value="">Selecione</option>
          {field.options?.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block text-sm font-medium text-zinc-700">
      {field.label}
      <input
        type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder ?? undefined}
        className={`${commonClass} mt-1`}
      />
      {field.help_text ? <span className="mt-1 block text-xs text-zinc-500">{field.help_text}</span> : null}
    </label>
  );
}
