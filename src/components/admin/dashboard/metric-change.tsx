import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricChangeProps {
  value: string;
  trend: "up" | "down" | "neutral";
  periodLabel?: string;
  className?: string;
}

const trendStyles: Record<
  MetricChangeProps["trend"],
  { pill: string; icon: typeof TrendingUp; prefixLabel: string }
> = {
  up: {
    pill: "bg-primary/10 text-primary border border-primary/20",
    icon: TrendingUp,
    prefixLabel: "Increase",
  },
  down: {
    pill: "bg-amber-100 text-amber-900 border border-amber-300",
    icon: TrendingDown,
    prefixLabel: "Decrease",
  },
  neutral: {
    pill: "bg-slate-100 text-text-secondary border border-slate-200",
    icon: Minus,
    prefixLabel: "No change",
  },
};

/** Accessible metric trend indicator pill showing directional delta and comparison window. */
export function MetricChange({
  value,
  trend,
  periodLabel,
  className,
}: MetricChangeProps) {
  const style = trendStyles[trend];
  const Icon = style.icon;

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
          style.pill
        )}
      >
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">{style.prefixLabel}:</span>
        <span>{value}</span>
      </span>
      {periodLabel && (
        <span className="text-xs text-text-secondary">{periodLabel}</span>
      )}
    </div>
  );
}
