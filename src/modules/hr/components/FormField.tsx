import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}

export const fieldClassName =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

export function FormField({ label, htmlFor, required, children, hint }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="text-[#f97316]"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
