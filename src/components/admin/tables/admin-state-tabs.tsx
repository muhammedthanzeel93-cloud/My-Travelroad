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
      className={cn("shrink-0", className)}
    >
      <TabsList aria-label="Preview view state">
        <TabsTrigger value="data">Populated</TabsTrigger>
        <TabsTrigger value="loading">Loading</TabsTrigger>
        <TabsTrigger value="empty">Empty</TabsTrigger>
        <TabsTrigger value="error">Error</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
