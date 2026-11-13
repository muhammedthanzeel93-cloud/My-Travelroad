"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Accessible admin table pagination bar showing item ranges and numbered controls. */
export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = "entries",
  onPageChange,
  className,
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  return (
    <nav
      aria-label="Admin table pagination"
      className={cn(
        "flex flex-col items-center justify-between gap-4 border-t border-border pt-4 sm:flex-row",
        className
      )}
    >
      <p className="text-xs sm:text-sm text-text-secondary tabular-nums">
        Showing{" "}
        <span className="font-semibold text-text-primary">
          {startItem}&ndash;{endItem}
        </span>{" "}
        of <span className="font-semibold text-text-primary">{totalItems}</span>{" "}
        {itemLabel}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Prev
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-1">
          {Array.from({ length: safeTotalPages }, (_, idx) => idx + 1).map(
            (pageNum) => {
              const isCurrent = pageNum === safePage;
              return (
                <Button
                  key={pageNum}
                  type="button"
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  aria-label={`Page ${pageNum}`}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => onPageChange(pageNum)}
                  className="min-w-[2.125rem] px-2 tabular-nums"
                >
                  {pageNum}
                </Button>
              );
            }
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
