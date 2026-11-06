"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";

interface FileUploadFieldProps {
  label: string;
  file?: File | null;
  accept?: string;
  hint?: string;
  onChange: (file: File | null) => void;
}

export function FileUploadField({ label, file, accept, hint, onChange }: FileUploadFieldProps) {
  const id = useId();
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files.item(0);
    if (droppedFile) onChange(droppedFile);
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <label
        htmlFor={id}
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-5 text-center transition ${
          isDragging
            ? "border-[#f97316] bg-orange-100"
            : "border-zinc-300 bg-zinc-50 hover:border-[#f97316] hover:bg-orange-50"
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-6 w-6 text-[#f97316]" />
        <span className="mt-2 text-sm font-medium text-zinc-800">
          {isDragging ? "Solte o arquivo aqui" : file ? file.name : "Arraste o arquivo aqui ou clique para selecionar"}
        </span>
        <span className="mt-1 text-xs text-zinc-500">
          {file ? "Arraste outro arquivo ou clique para trocar" : hint ?? "Selecione ou arraste um arquivo"}
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
