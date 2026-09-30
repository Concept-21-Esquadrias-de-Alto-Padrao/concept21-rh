"use client";

import { Upload } from "lucide-react";
import { useId } from "react";

interface FileUploadFieldProps {
  label: string;
  file?: File | null;
  accept?: string;
  onChange: (file: File | null) => void;
}

export function FileUploadField({ label, file, accept, onChange }: FileUploadFieldProps) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <label
        htmlFor={id}
        className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center transition hover:border-[#f97316] hover:bg-orange-50"
      >
        <Upload className="h-6 w-6 text-[#f97316]" />
        <span className="mt-2 text-sm font-medium text-zinc-800">
          {file ? file.name : "Selecionar arquivo"}
        </span>
        <span className="mt-1 text-xs text-zinc-500">PDF, imagem, DOCX ou XLSX até 15 MB</span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
