"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AdminSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/** Reusable admin search box built on Task 01 Input with prefix search icon and clear trigger. */
export function AdminSearchInput({
  value,
  onChange,
  placeholder = "Search records...",
  ariaLabel = "Search admin records",
  className,
}: AdminSearchInputProps) {
  return (
    <div className={cn("w-full sm:max-w-sm", className)}>
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        startIcon={<Search className="h-4 w-4" aria-hidden="true" />}
        endIcon={
          value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Clear search query"
              className="rounded-sm p-0.5 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : undefined
        }
        className="h-9 bg-surface"
      />
    </div>
  );
}
