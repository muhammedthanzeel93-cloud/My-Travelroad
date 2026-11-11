import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface AdminEmptyStateProps extends Omit<EmptyStateProps, "icon"> {
  icon?: LucideIcon;
  compact?: boolean;
}

/** Admin empty-state container reusing Task 01 EmptyState tokens and actions. */
export function AdminEmptyState({
  icon = Inbox,
  compact = false,
  className,
  ...props
}: AdminEmptyStateProps) {
  return (
    <EmptyState
      icon={icon}
      className={cn(compact && "p-6 sm:p-8", className)}
      {...props}
    />
  );
}
