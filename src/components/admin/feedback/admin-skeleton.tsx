import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton matching StatCard dimensions. */
export function AdminStatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </CardHeader>
      <CardContent className="space-y-2.5">
        <Skeleton className="h-8 w-16" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Loading skeleton for chart and analytics placeholder containers. */
export function AdminChartSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label="Loading chart">
      <div className="space-y-3">
        {[82, 64, 52, 38].map((widthPct, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <Skeleton
              className="h-2.5 rounded-full"
              style={{ width: `${widthPct}%` }}
            />
          </div>
        ))}
      </div>
      <Skeleton className="h-3 w-48" />
    </div>
  );
}

/** Loading skeleton for tabular admin datasets across desktop tables and mobile cards. */
export function AdminTableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div aria-busy="true" aria-label="Loading table rows">
      {/* Mobile card skeleton stack (< 768px) */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: Math.min(rows, 3) }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="rounded-xl border border-border bg-surface p-3.5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Tablet & desktop tabular skeleton (>= 768px) */}
      <div className="hidden md:block divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-4 bg-slate-50/80 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded-sm" />
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-3.5 flex-1 max-w-[140px]" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
            {Array.from({ length: Math.max(1, columns - 1) }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                className="h-5 flex-1 max-w-[100px] rounded-full"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loading skeleton for admin form sections. */
export function AdminFormSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2 border-b border-border/70">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3.5 w-72" />
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
