import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface SampleDataNoticeProps {
  title?: string;
  message: string;
  badgeText?: string;
  className?: string;
}

export function SampleDataNotice({
  title = "Development Preview Layout",
  message,
  badgeText = "Sample Data Only",
  className,
}: SampleDataNoticeProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm shadow-subtle sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-secondary sm:mt-0" aria-hidden="true" />
        <div>
          <span className="font-semibold text-text-primary">{title}: </span>
          <span className="text-text-secondary">{message}</span>
        </div>
      </div>
      <Badge variant="muted" size="sm" className="self-start shrink-0 sm:self-center">
        {badgeText}
      </Badge>
    </div>
  );
}
