"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface BulkSelectionCheckboxProps {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean | "indeterminate") => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/** Row & select-all checkbox supporting checked, unchecked, and indeterminate visual states. */
export function BulkSelectionCheckbox({
  checked,
  onCheckedChange,
  ariaLabel,
  disabled = false,
  className,
}: BulkSelectionCheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "peer flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border bg-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        className
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {checked === "indeterminate" ? (
          <Minus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
        ) : (
          <Check className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export interface BulkSelectionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions?: React.ReactNode;
  className?: string;
}

/** Contextual action bar surfaced above/within a DataTable toolbar when rows are checked. */
export function BulkSelectionBar({
  selectedCount,
  onClearSelection,
  actions,
  className,
}: BulkSelectionBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Bulk selection actions"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <Badge variant="default" size="sm">
          {selectedCount} selected
        </Badge>
        <span className="text-xs font-medium text-text-primary">
          Sample bulk selection ready for action preview
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
        >
          Clear Selection
        </Button>
      </div>
    </div>
  );
}
