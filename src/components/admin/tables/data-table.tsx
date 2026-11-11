"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTableSkeleton } from "@/components/admin/feedback/admin-skeleton";
import { AdminEmptyState } from "@/components/admin/feedback/admin-empty-state";
import { AdminErrorState } from "@/components/admin/feedback/admin-error-state";
import { BulkSelectionCheckbox } from "./bulk-selection-checkbox";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  widthClassName?: string;
  sortable?: boolean;
  cell: (row: T) => React.ReactNode;
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

const alignClasses: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Generic TypeScript-typed admin data table supporting selection, sorting, loading, empty, and error states. */
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

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-card",
        className
      )}
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="border-b border-border bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            <tr>
              {selectable && (
                <th scope="col" className="w-12 px-4 py-3.5">
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
                      "px-3 py-3.5 whitespace-nowrap",
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
                    <td className="w-12 px-4 py-3.5 align-middle">
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
                        "px-3 py-3.5 align-middle text-text-primary",
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
  );
}
