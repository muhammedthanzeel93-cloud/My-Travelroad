import * as React from "react";
import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/status/status-badge";
import { AdminEmptyState } from "@/components/admin/feedback/admin-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminSampleActivityItem } from "@/data/admin-sample-data";

export interface ActivitySummaryCardProps {
  title: string;
  description?: string;
  items: AdminSampleActivityItem[];
  badgeText?: string;
  isLoading?: boolean;
  footerAction?: React.ReactNode;
  className?: string;
}

/** Structured recent admin activity feed card using unified StatusBadge indicators. */
export function ActivitySummaryCard({
  title,
  description,
  items,
  badgeText,
  isLoading = false,
  footerAction,
  className,
}: ActivitySummaryCardProps) {
  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            {badgeText && (
              <Badge variant="muted" size="sm">
                {badgeText}
              </Badge>
            )}
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-text-secondary">
          <Activity className="h-4 w-4" aria-hidden="true" />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        {isLoading ? (
          <div className="divide-y divide-border p-6 space-y-4">
            {[1, 2, 3].map((row) => (
              <div key={row} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState
              compact
              title="No recent admin activity"
              description="Recent sample moderation and curation logs will display here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {item.title}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {item.subtitle} &bull; {item.actor}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <StatusBadge status={item.status} size="sm" />
                  <span className="text-[11px] text-text-secondary whitespace-nowrap">
                    {item.timestamp}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {footerAction && (
        <CardFooter className="border-t border-border/60 bg-slate-50/60 px-6 py-3">
          {footerAction}
        </CardFooter>
      )}
    </Card>
  );
}
