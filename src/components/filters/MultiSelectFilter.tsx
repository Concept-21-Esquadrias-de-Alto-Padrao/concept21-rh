"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { filterFieldClassName } from "@/components/filters/filterStyles";
import { toggleFilterValue, uniqueFilterValues } from "@/components/filters/filter-utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectFilterProps {
  label?: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
  selectedLabel?: (count: number) => string;
  ariaLabel?: string;
}

function defaultSelectedLabel(count: number) {
  return `${count} selecionados`;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSummary(
  selectedOptions: MultiSelectOption[],
  placeholder: string,
  selectedLabel: (count: number) => string,
) {
  if (selectedOptions.length === 0) {
    return placeholder;
  }

  if (selectedOptions.length === 1) {
    return selectedOptions[0].label;
  }

  if (selectedOptions.length === 2) {
    const joined = `${selectedOptions[0].label} + ${selectedOptions[1].label}`;
    return joined.length <= 34 ? joined : selectedLabel(2);
  }

  return selectedLabel(selectedOptions.length);
}

export function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
  placeholder = "Todos",
  searchable = false,
  disabled = false,
  loading = false,
  emptyText = "Nenhuma opção encontrada",
  selectedLabel = defaultSelectedLabel,
  ariaLabel,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const labelId = useId();
  const selectedValues = useMemo(() => new Set(values), [values]);
  const selectedOptions = options.filter((option) => selectedValues.has(option.value));
  const summary = getSummary(selectedOptions, placeholder, selectedLabel);
  const visibleOptions = useMemo(() => {
    const query = normalizeSearch(search);

    if (!query) {
      return options;
    }

    return options.filter((option) => normalizeSearch(option.label).includes(query));
  }, [options, search]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setSearch("");
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open && searchable) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  function commitChange(nextValues: string[]) {
    onChange(uniqueFilterValues(nextValues));
  }

  function toggleOption(value: string) {
    commitChange(toggleFilterValue(values, value));
  }

  function closeDropdown() {
    setSearch("");
    setOpen(false);
  }

  function handleTriggerClick() {
    if (open) {
      closeDropdown();
      return;
    }

    setOpen(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }

    if (event.key === "Escape") {
      closeDropdown();
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, value: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleOption(value);
    }

    if (event.key === "Escape") {
      closeDropdown();
      triggerRef.current?.focus();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {label ? (
        <label id={labelId} className="mb-1 block text-sm font-medium text-zinc-700">
          {label}
        </label>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        className={`${filterFieldClassName} flex items-center justify-between gap-2 text-left ${
          disabled || loading ? "cursor-not-allowed bg-zinc-100 text-zinc-400" : ""
        }`}
        aria-label={ariaLabel ?? label ?? "Filtro multisseleção"}
        aria-labelledby={label ? labelId : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled || loading}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selectedOptions.length === 0 ? "truncate text-zinc-900" : "truncate"}>
          {loading ? "Carregando..." : summary}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full min-w-60 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {searchable ? (
            <div className="border-b border-zinc-100 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  ref={searchRef}
                  className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-8 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  value={search}
                  placeholder="Buscar opção"
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      closeDropdown();
                      triggerRef.current?.focus();
                    }
                  }}
                />
                {search ? (
                  <button
                    type="button"
                    className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                    onClick={() => setSearch("")}
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            className="max-h-64 overflow-y-auto"
          >
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-zinc-500">{emptyText}</p>
            ) : (
              visibleOptions.map((option) => {
                const checked = selectedValues.has(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    disabled={option.disabled}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 transition hover:bg-orange-50 focus:bg-orange-50 focus:outline-none disabled:cursor-not-allowed disabled:text-zinc-400"
                    onClick={() => toggleOption(option.value)}
                    onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                        checked
                          ? "border-[#f97316] bg-[#f97316] text-white"
                          : "border-zinc-300 bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      {checked ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-zinc-100 px-2 py-1">
            <button
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-xs font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-[#f97316] focus:bg-zinc-50 focus:text-[#f97316] focus:outline-none"
              onClick={() => {
                commitChange([]);
                triggerRef.current?.focus();
              }}
            >
              Limpar seleção
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

