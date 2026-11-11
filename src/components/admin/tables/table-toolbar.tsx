import * as React from "react";
import { cn } from "@/lib/utils";

export interface TableToolbarProps {
  searchSlot?: React.ReactNode;
  filtersSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  bulkSelectionSlot?: React.ReactNode;
  className?: string;
}

/** Responsive toolbar container aligning search, filter selectors, primary actions, and bulk bars. */
export function TableToolbar({
  searchSlot,
  filtersSlot,
  actionsSlot,
  bulkSelectionSlot,
  className,
}: TableToolbarProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {searchSlot}
          {filtersSlot}
        </div>

        {actionsSlot && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actionsSlot}
          </div>
        )}
      </div>

      {bulkSelectionSlot}
    </div>
  );
}
