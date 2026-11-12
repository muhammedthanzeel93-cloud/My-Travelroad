import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AdminSampleBannerProps {
  title?: string;
  description?: string;
  badgeText?: string;
  className?: string;
}

/** Shared notice banner clearly marking Task 04 admin sample data and placeholder actions. */
export function AdminSampleBanner({
  title = "Development-Only UI Structure:",
  description = "Records, metrics, filters, and action triggers reflect in-memory sample data only. Authentication, database persistence, and backend APIs are excluded.",
  badgeText = "Sample Data Only",
  className,
}: AdminSampleBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm shadow-subtle sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-secondary sm:mt-0"
          aria-hidden="true"
        />
        <p className="text-text-secondary leading-relaxed">
          <span className="font-semibold text-text-primary">{title} </span>
          {description}
        </p>
      </div>
      <Badge
        variant="muted"
        size="sm"
        className="self-start sm:self-center shrink-0"
      >
        {badgeText}
      </Badge>
    </div>
  );
}
