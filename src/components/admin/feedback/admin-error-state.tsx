import { ErrorState, type ErrorStateProps } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";

export interface AdminErrorStateProps extends ErrorStateProps {
  compact?: boolean;
}

/** Admin failure/error state reusing Task 01 ErrorState with optional compact sizing. */
export function AdminErrorState({
  title = "Unable to load admin records",
  description = "A simulated data retrieval issue occurred. Retry to restore the sample view.",
  compact = false,
  className,
  ...props
}: AdminErrorStateProps) {
  return (
    <ErrorState
      title={title}
      description={description}
      className={cn(compact && "p-6 sm:p-8", className)}
      {...props}
    />
  );
}
