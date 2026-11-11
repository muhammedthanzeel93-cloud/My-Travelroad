import * as React from "react";
import { BarChart3 } from "lucide-react";
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
import { AdminChartSkeleton } from "@/components/admin/feedback/admin-skeleton";
import { AdminEmptyState } from "@/components/admin/feedback/admin-empty-state";
import { AdminErrorState } from "@/components/admin/feedback/admin-error-state";
import type { AdminSampleDistribution } from "@/data/admin-sample-data";

export interface ChartContainerProps {
  title: string;
  description?: string;
  badgeText?: string;
  headerAction?: React.ReactNode;
  footerNote?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
  className?: string;
}

/** Structured card wrapper for admin charts and visual distributions supporting loading/empty/error states. */
export function ChartContainer({
  title,
  description,
  badgeText,
  headerAction,
  footerNote,
  isLoading = false,
  isEmpty = false,
  errorMessage,
  onRetry,
  children,
  className,
}: ChartContainerProps) {
  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
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
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </CardHeader>

      <CardContent className="flex-1 pt-5">
        {isLoading ? (
          <AdminChartSkeleton />
        ) : errorMessage ? (
          <AdminErrorState
            compact
            title="Chart unavailable"
            errorMessage={errorMessage}
            onRetry={onRetry}
          />
        ) : isEmpty ? (
          <AdminEmptyState
            compact
            icon={BarChart3}
            title="No distribution data"
            description="Sample visualization metrics will appear here once entries exist."
          />
        ) : (
          children
        )}
      </CardContent>

      {footerNote && (
        <CardFooter className="border-t border-border/60 bg-slate-50/60 px-6 py-3 text-xs text-text-secondary">
          {footerNote}
        </CardFooter>
      )}
    </Card>
  );
}

const barColorClasses: Record<AdminSampleDistribution["tone"], string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
};

/** Clean, gradient-free horizontal proportion display for sample admin breakdowns. */
export function SampleBarBreakdown({
  items,
}: {
  items: AdminSampleDistribution[];
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
            <span className="font-medium text-text-primary">{item.label}</span>
            <span className="text-text-secondary tabular-nums">
              {item.countLabel} ({item.percentage}%)
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={item.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${item.label}: ${item.percentage}%`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                barColorClasses[item.tone]
              )}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
