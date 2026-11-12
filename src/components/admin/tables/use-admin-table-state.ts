"use client";

import * as React from "react";
import type { AdminPreviewMode } from "./admin-state-tabs";
import type { SortDirection } from "./data-table";

export interface UseAdminTableStateOptions {
  initialSortKey: string;
  initialSortDirection?: SortDirection;
  pageSize?: number;
}

/**
 * Shared client-side UI state helper managing preview mode, sorting,
 * selection checkboxes, and bounded page indexing across admin tables.
 */
export function useAdminTableState({
  initialSortKey,
  initialSortDirection = "asc",
  pageSize = 5,
}: UseAdminTableStateOptions) {
  const [tableMode, setTableMode] = React.useState<AdminPreviewMode>("data");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<string>(initialSortKey);
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>(initialSortDirection);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const handleSortChange = React.useCallback(
    (columnKey: string) => {
      if (sortKey === columnKey) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(columnKey);
        setSortDirection("asc");
      }
    },
    [sortKey]
  );

  const handleSearchChange = React.useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  const paginateRows = React.useCallback(
    <T,>(rows: T[]) => {
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      const safePage = Math.min(currentPage, totalPages);
      const startIndex = (safePage - 1) * pageSize;
      return {
        totalPages,
        safePage,
        pageSize,
        paginatedRows: rows.slice(startIndex, startIndex + pageSize),
      };
    },
    [currentPage, pageSize]
  );

  return {
    tableMode,
    setTableMode,
    searchQuery,
    setSearchQuery: handleSearchChange,
    sortKey,
    sortDirection,
    handleSortChange,
    currentPage,
    setCurrentPage,
    selectedIds,
    setSelectedIds,
    paginateRows,
  };
}
