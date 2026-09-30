"use client";

import { DateFilter } from "@/components/filters/DateFilter";

export interface DateRangeFilterProps {
  startLabel?: string;
  endLabel?: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  disabled?: boolean;
}

export function DateRangeFilter({
  startLabel = "Data inicial",
  endLabel = "Data final",
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  disabled = false,
}: DateRangeFilterProps) {
  return (
    <>
      <DateFilter label={startLabel} value={startValue} onChange={onStartChange} disabled={disabled} />
      <DateFilter label={endLabel} value={endValue} onChange={onEndChange} disabled={disabled} />
    </>
  );
}

