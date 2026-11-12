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

export interface SampleColumnPoint {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number;
  valueLabel?: string;
}

/**
 * Gradient-free CSS-token vertical bar chart for development sample analytics
 * without introducing external charting dependencies.
 */
export function SampleColumnChart({
  points,
  primaryLabel = "Submissions",
  secondaryLabel = "Verified",
}: {
  points: SampleColumnPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const maxVal = Math.max(
    1,
    ...points.map((pt) => Math.max(pt.value, pt.secondaryValue ?? 0))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden="true" />
          <span>{primaryLabel}</span>
        </span>
        {points.some((pt) => typeof pt.secondaryValue === "number") && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-secondary"
              aria-hidden="true"
            />
            <span>{secondaryLabel}</span>
          </span>
        )}
      </div>

      <div
        className="grid items-end gap-2 sm:gap-3 pt-2"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, points.length)}, minmax(0, 1fr))`,
        }}
      >
        {points.map((pt) => {
          const primaryHeight = Math.max(10, Math.round((pt.value / maxVal) * 100));
          const secondaryHeight =
            typeof pt.secondaryValue === "number"
              ? Math.max(8, Math.round((pt.secondaryValue / maxVal) * 100))
              : null;

          return (
            <div key={pt.id} className="flex flex-col items-center gap-2 min-w-0">
              <span className="text-[11px] font-semibold text-text-primary tabular-nums">
                {pt.valueLabel ?? pt.value}
              </span>
              <div className="flex h-36 w-full max-w-[44px] items-end justify-center gap-1 rounded-lg bg-slate-100/80 px-1.5 pb-1.5 pt-2">
                <div
                  role="img"
                  aria-label={`${pt.label} ${primaryLabel}: ${pt.value}`}
                  className="w-full max-w-[14px] rounded-t bg-primary transition-all duration-300"
                  style={{ height: `${primaryHeight}%` }}
                />
                {secondaryHeight !== null && (
                  <div
                    role="img"
                    aria-label={`${pt.label} ${secondaryLabel}: ${pt.secondaryValue}`}
                    className="w-full max-w-[14px] rounded-t bg-secondary transition-all duration-300"
                    style={{ height: `${secondaryHeight}%` }}
                  />
                )}
              </div>
              <span className="truncate text-[11px] font-medium text-text-secondary">
                {pt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
