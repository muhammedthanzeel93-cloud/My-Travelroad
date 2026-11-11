import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AdminStatCardSkeleton } from "@/components/admin/feedback/admin-skeleton";
import { MetricChange, type MetricChangeProps } from "./metric-change";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "primary" | "secondary" | "accent" | "muted";
  change?: MetricChangeProps;
  footnote?: string;
  loading?: boolean;
  className?: string;
}

const iconToneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  accent: "bg-amber-100 text-amber-800",
  muted: "bg-slate-100 text-text-secondary",
};

/** Admin KPI statistic card built on Task 01 Card with optional loading skeleton and trend pill. */
export function StatCard({
  title,
  value,
  icon: Icon,
  tone = "primary",
  change,
  footnote,
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return <AdminStatCardSkeleton />;
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            iconToneClasses[tone]
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <p className="text-3xl font-extrabold tracking-tight text-text-primary tabular-nums">
          {value}
        </p>
        {change && <MetricChange {...change} />}
        {footnote && (
          <p className="text-xs text-text-secondary">{footnote}</p>
        )}
      </CardContent>
    </Card>
  );
}
