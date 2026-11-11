"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface TableFilterSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  className?: string;
}

/** Single accessible dropdown filter built on Task 01 Select. */
export function TableFilterSelect({
  label,
  value,
  onValueChange,
  options,
  className,
}: TableFilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className={cn("h-9 w-full sm:w-[175px] bg-surface text-xs sm:text-sm", className)}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface TableFilterBarProps {
  filters: {
    id: string;
    label: string;
    value: string;
    onValueChange: (value: string) => void;
    options: FilterOption[];
  }[];
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  className?: string;
}

/** Multi-filter bar organizing dropdown filters and an optional reset control. */
export function TableFilterBar({
  filters,
  hasActiveFilters = false,
  onResetFilters,
  className,
}: TableFilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Filters
      </span>

      {filters.map((filter) => (
        <TableFilterSelect
          key={filter.id}
          label={filter.label}
          value={filter.value}
          onValueChange={filter.onValueChange}
          options={filter.options}
        />
      ))}

      {hasActiveFilters && onResetFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          className="text-text-secondary hover:text-primary"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Reset
        </Button>
      )}
    </div>
  );
}
