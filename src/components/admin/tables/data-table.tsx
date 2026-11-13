"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  MoveHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminTableSkeleton } from "@/components/admin/feedback/admin-skeleton";
import { AdminEmptyState } from "@/components/admin/feedback/admin-empty-state";
import { AdminErrorState } from "@/components/admin/feedback/admin-error-state";
import { BulkSelectionCheckbox } from "./bulk-selection-checkbox";

export type DataTableMobileRole =
  | "primary"
  | "description"
  | "status"
  | "actions"
  | "secondary"
  | "hidden";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  widthClassName?: string;
  sortable?: boolean;
  cell: (row: T) => React.ReactNode;
  /** Controls how the column maps onto responsive mobile cards below 768px. */
  mobileRole?: DataTableMobileRole;
  /** Optional concise label shown in expanded mobile details and sort dropdown. */
  mobileLabel?: string;
}

export type SortDirection = "asc" | "desc";

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  getRowLabel?: (row: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (nextIds: string[]) => void;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSortChange?: (columnKey: string) => void;
  isLoading?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  caption?: string;
  className?: string;
}

const alignClasses: Record<
  NonNullable<DataTableColumn<unknown>["align"]>,
  string
> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Partitions table columns into primary, description, status, actions, and expandable secondary mobile roles. */
function partitionMobileColumns<T>(columns: DataTableColumn<T>[]) {
  const hasExplicitRoles = columns.some((col) => col.mobileRole !== undefined);

  const actionsColumn =
    columns.find((col) => col.mobileRole === "actions") ??
    columns.find((col) => col.key === "actions");

  const primaryColumn =
    columns.find((col) => col.mobileRole === "primary") ??
    columns.find(
      (col) => col !== actionsColumn && col.mobileRole !== "hidden"
    );

  const descriptionColumn =
    columns.find((col) => col.mobileRole === "description") ??
    columns.find(
      (col) =>
        col !== primaryColumn &&
        col !== actionsColumn &&
        (col.key === "description" || col.key === "excerpt")
    );

  const statusColumns = hasExplicitRoles
    ? columns.filter((col) => col.mobileRole === "status")
    : columns.filter(
        (col) =>
          col !== primaryColumn &&
          col !== actionsColumn &&
          col !== descriptionColumn &&
          (col.key === "status" ||
            col.key === "verification" ||
            col.key === "verificationStatus" ||
            col.key === "rating")
      );

  const secondaryColumns = columns.filter(
    (col) =>
      col.mobileRole !== "hidden" &&
      col !== primaryColumn &&
      col !== actionsColumn &&
      col !== descriptionColumn &&
      !statusColumns.includes(col)
  );

  return {
    primaryColumn,
    descriptionColumn,
    statusColumns,
    actionsColumn,
    secondaryColumns,
  };
}

/**
 * Generic TypeScript-typed admin data table supporting:
 * - Expandable mobile cards below 768px (zero horizontal overflow)
 * - Clearly defined, keyboard-scrollable table container at tablet widths
 * - Full multi-column desktop table layout with sorting, selection, loading, empty, and error states
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  getRowLabel,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  sortKey,
  sortDirection,
  onSortChange,
  isLoading = false,
  errorMessage,
  onRetry,
  emptyTitle = "No sample rows match your criteria",
  emptyDescription = "Adjust the search keyword or reset table filters to inspect matching records.",
  emptyAction,
  caption,
  className,
}: DataTableProps<T>) {
  const tableIdPrefix = React.useId();
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [expandedRowIds, setExpandedRowIds] = React.useState<string[]>([]);
  const [scrollState, setScrollState] = React.useState({
    hasOverflow: false,
    canScrollRight: false,
  });

  const updateScrollCue = React.useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const hasOverflow = el.scrollWidth - el.clientWidth > 4;
    const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;

    setScrollState((prev) =>
      prev.hasOverflow === hasOverflow && prev.canScrollRight === canScrollRight
        ? prev
        : { hasOverflow, canScrollRight }
    );
  }, []);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    updateScrollCue();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateScrollCue())
        : null;
    observer?.observe(el);

    el.addEventListener("scroll", updateScrollCue, { passive: true });
    window.addEventListener("resize", updateScrollCue);

    return () => {
      observer?.disconnect();
      el.removeEventListener("scroll", updateScrollCue);
      window.removeEventListener("resize", updateScrollCue);
    };
  }, [updateScrollCue, data, columns]);

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={Math.min(columns.length, 5)} />;
  }

  if (errorMessage) {
    return (
      <AdminErrorState
        title="Unable to render table preview"
        errorMessage={errorMessage}
        onRetry={onRetry}
      />
    );
  }

  if (data.length === 0) {
    return (
      <AdminEmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionComponent={emptyAction}
      />
    );
  }

  const visibleRowIds = data.map(getRowId);
  const selectedOnPage = visibleRowIds.filter((id) => selectedIds.includes(id));
  const allVisibleSelected =
    visibleRowIds.length > 0 && selectedOnPage.length === visibleRowIds.length;
  const someVisibleSelected =
    selectedOnPage.length > 0 && selectedOnPage.length < visibleRowIds.length;

  const handleToggleAll = () => {
    if (!onSelectionChange) return;
    if (allVisibleSelected) {
      onSelectionChange(selectedIds.filter((id) => !visibleRowIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...visibleRowIds]);
      onSelectionChange(Array.from(merged));
    }
  };

  const handleToggleRow = (rowId: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(rowId)) {
      onSelectionChange(selectedIds.filter((id) => id !== rowId));
    } else {
      onSelectionChange([...selectedIds, rowId]);
    }
  };

  const toggleRowExpanded = (rowId: string) => {
    setExpandedRowIds((prev) =>
      prev.includes(rowId)
        ? prev.filter((id) => id !== rowId)
        : [...prev, rowId]
    );
  };

  const {
    primaryColumn,
    descriptionColumn,
    statusColumns,
    actionsColumn,
    secondaryColumns,
  } = partitionMobileColumns(columns);
  const sortableColumns = columns.filter((col) => col.sortable);
  const activeSortKey =
    sortKey && sortableColumns.some((col) => col.key === sortKey)
      ? sortKey
      : sortableColumns[0]?.key;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mobile Card/List Presentation (< 768px) */}
      <div className="space-y-3 md:hidden">
        {(selectable || (sortableColumns.length > 0 && onSortChange)) && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-slate-50/90 px-3 py-2">
            {selectable ? (
              <div className="flex items-center gap-2">
                <BulkSelectionCheckbox
                  checked={
                    allVisibleSelected
                      ? true
                      : someVisibleSelected
                      ? "indeterminate"
                      : false
                  }
                  onCheckedChange={handleToggleAll}
                  ariaLabel="Select all rows on current page"
                />
                <span className="text-xs font-medium text-text-secondary">
                  Select all ({selectedOnPage.length}/{visibleRowIds.length})
                </span>
              </div>
            ) : (
              <span className="text-xs font-medium text-text-secondary">
                {visibleRowIds.length} entries
              </span>
            )}

            {sortableColumns.length > 0 && onSortChange && activeSortKey && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Select
                  value={activeSortKey}
                  onValueChange={(nextKey) => {
                    if (nextKey !== sortKey) {
                      onSortChange(nextKey);
                    }
                  }}
                >
                  <SelectTrigger
                    aria-label="Sort entries by"
                    className="h-8 w-[150px] bg-surface text-xs"
                  >
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortableColumns.map((col) => (
                      <SelectItem key={col.key} value={col.key}>
                        {col.mobileLabel ?? col.header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onSortChange(activeSortKey)}
                  aria-label={`Sort direction ${
                    sortDirection === "desc" ? "descending" : "ascending"
                  }. Toggle sort order`}
                  className="h-8 w-8 bg-surface shrink-0"
                >
                  {sortDirection === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        <div
          role="list"
          aria-label={caption ?? "Records list"}
          className="space-y-3"
        >
          {data.map((row) => {
            const rowId = getRowId(row);
            const isSelected = selectedIds.includes(rowId);
            const isExpanded = expandedRowIds.includes(rowId);
            const detailsId = `${tableIdPrefix}-details-${rowId}`;
            const rowAriaLabel = getRowLabel
              ? `Select ${getRowLabel(row)}`
              : `Select row ${rowId}`;

            return (
              <article
                key={rowId}
                role="listitem"
                data-selected={isSelected ? "true" : "false"}
                className={cn(
                  "rounded-xl border border-border bg-surface p-3.5 shadow-subtle transition-colors space-y-2.5",
                  isSelected && "border-primary/40 bg-primary/[0.04]"
                )}
              >
                {/* Primary Row + Top-Right Action Menu */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    {selectable && (
                      <div className="pt-0.5 shrink-0">
                        <BulkSelectionCheckbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleRow(rowId)}
                          ariaLabel={rowAriaLabel}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 break-words text-sm">
                      {primaryColumn?.cell(row)}
                    </div>
                  </div>

                  {actionsColumn && (
                    <div className="shrink-0 -mr-1 -mt-0.5">
                      {actionsColumn.cell(row)}
                    </div>
                  )}
                </div>

                {/* Direct Mobile Description / Excerpt (Prominently readable) */}
                {descriptionColumn && (
                  <div className="text-xs text-text-secondary leading-relaxed break-words pt-0.5 [&_p]:max-w-none [&_p]:line-clamp-none">
                    {descriptionColumn.cell(row)}
                  </div>
                )}

                {/* Primary Status Badges & Details Disclosure Trigger */}
                {(statusColumns.length > 0 || secondaryColumns.length > 0) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      {statusColumns.map((col) => (
                        <React.Fragment key={col.key}>
                          {col.cell(row)}
                        </React.Fragment>
                      ))}
                    </div>

                    {secondaryColumns.length > 0 && (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        onClick={() => toggleRowExpanded(rowId)}
                        className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-slate-50 px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                      >
                        <span>{isExpanded ? "Hide details" : "Details"}</span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform duration-150",
                            isExpanded && "rotate-180"
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </div>
                )}

                {/* Expandable Secondary Details */}
                {isExpanded && secondaryColumns.length > 0 && (
                  <dl
                    id={detailsId}
                    className="grid grid-cols-1 gap-2.5 border-t border-border/70 pt-3 text-xs"
                  >
                    {secondaryColumns.map((col) => (
                      <div key={col.key} className="space-y-1 min-w-0">
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                          {col.mobileLabel ?? col.header}
                        </dt>
                        <dd className="text-text-primary break-words [&_*]:whitespace-normal [&_p]:max-w-none [&_p]:line-clamp-none">
                          {col.cell(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* Tablet & Desktop Tabular Presentation (>= 768px) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {scrollState.hasOverflow && (
          <div className="flex items-center justify-between gap-2 border-b border-border bg-slate-50/90 px-3.5 py-1.5 text-[11px] font-medium text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <MoveHorizontal
                className="h-3.5 w-3.5 text-primary shrink-0"
                aria-hidden="true"
              />
              <span>Scroll horizontally to inspect all columns</span>
            </span>
            <span className="tabular-nums">
              {scrollState.canScrollRight ? "More right" : "End of table"}
            </span>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          role="region"
          tabIndex={0}
          aria-label={caption ?? "Data table"}
          className={cn(
            "w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
            scrollState.canScrollRight && "border-r-2 border-primary/20"
          )}
        >
          <table className="w-full border-collapse text-left text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="border-b border-border bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                {selectable && (
                  <th scope="col" className="w-11 px-3 py-3 lg:px-3.5 lg:py-3.5">
                    <div className="flex items-center justify-center">
                      <BulkSelectionCheckbox
                        checked={
                          allVisibleSelected
                            ? true
                            : someVisibleSelected
                            ? "indeterminate"
                            : false
                        }
                        onCheckedChange={handleToggleAll}
                        ariaLabel="Select all rows on current page"
                      />
                    </div>
                  </th>
                )}

                {columns.map((column) => {
                  const align = column.align ?? "left";
                  const isSorted = sortKey === column.key;
                  const ariaSort = column.sortable
                    ? isSorted
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined;

                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={ariaSort}
                      className={cn(
                        "px-3 py-3 lg:px-3.5 lg:py-3.5 whitespace-nowrap",
                        alignClasses[align],
                        column.widthClassName
                      )}
                    >
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => onSortChange(column.key)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-sm font-semibold uppercase tracking-wider transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            isSorted ? "text-primary" : "text-text-secondary"
                          )}
                        >
                          <span>{column.header}</span>
                          {isSorted ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown
                              className="h-3.5 w-3.5 opacity-60"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-border bg-surface">
              {data.map((row) => {
                const rowId = getRowId(row);
                const isSelected = selectedIds.includes(rowId);
                const rowAriaLabel = getRowLabel
                  ? `Select ${getRowLabel(row)}`
                  : `Select row ${rowId}`;

                return (
                  <tr
                    key={rowId}
                    data-selected={isSelected ? "true" : "false"}
                    className={cn(
                      "transition-colors hover:bg-slate-50/80",
                      isSelected && "bg-primary/[0.04]"
                    )}
                  >
                    {selectable && (
                      <td className="w-11 px-3 py-3 lg:px-3.5 lg:py-3.5 align-middle">
                        <div className="flex items-center justify-center">
                          <BulkSelectionCheckbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleRow(rowId)}
                            ariaLabel={rowAriaLabel}
                          />
                        </div>
                      </td>
                    )}

                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-3 py-3 lg:px-3.5 lg:py-3.5 align-middle text-text-primary",
                          alignClasses[column.align ?? "left"],
                          column.widthClassName
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
