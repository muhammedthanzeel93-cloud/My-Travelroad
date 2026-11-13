"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type AdminPreviewMode = "data" | "loading" | "empty" | "error";

export interface AdminStateTabsProps {
  value: AdminPreviewMode;
  onValueChange: (mode: AdminPreviewMode) => void;
  className?: string;
}

/** Reusable view-state switcher for previewing populated, loading, empty, and error states. */
export function AdminStateTabs({
  value,
  onValueChange,
  className,
}: AdminStateTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as AdminPreviewMode)}
      className={cn("w-full sm:w-auto shrink-0", className)}
    >
      <TabsList
        aria-label="Preview view state"
        className="w-full sm:w-auto max-w-full overflow-x-auto"
      >
        <TabsTrigger value="data" className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 text-xs sm:text-sm">
          Populated
        </TabsTrigger>
        <TabsTrigger value="loading" className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 text-xs sm:text-sm">
          Loading
        </TabsTrigger>
        <TabsTrigger value="empty" className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 text-xs sm:text-sm">
          Empty
        </TabsTrigger>
        <TabsTrigger value="error" className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 text-xs sm:text-sm">
          Error
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
