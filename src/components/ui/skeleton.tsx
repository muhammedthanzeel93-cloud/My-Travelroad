import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/50",
        className
      )}
      {...props}
    />
  );
}

function DestinationCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
        <Skeleton className="h-6 w-3/4 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
        <div className="pt-2 flex items-center justify-between">
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export { Skeleton, DestinationCardSkeleton };
