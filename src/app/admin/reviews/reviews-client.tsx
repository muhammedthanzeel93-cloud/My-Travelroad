"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  MessageSquare,
  Star,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSampleBanner } from "@/components/admin/feedback/admin-sample-banner";
import { ConfirmDialog } from "@/components/admin/feedback/confirm-dialog";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import { StatusBadge } from "@/components/admin/status/status-badge";
import { AdminSearchInput } from "@/components/admin/tables/admin-search-input";
import { TableFilterBar } from "@/components/admin/tables/table-filters";
import { TableToolbar } from "@/components/admin/tables/table-toolbar";
import { RowActionMenu } from "@/components/admin/tables/row-action-menu";
import { TablePagination } from "@/components/admin/tables/table-pagination";
import { AdminStateTabs } from "@/components/admin/tables/admin-state-tabs";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/tables/data-table";
import { useAdminTableState } from "@/components/admin/tables/use-admin-table-state";
import {
  ADMIN_REVIEW_RECORDS,
  type AdminSampleReview,
} from "@/data/admin-sample-data";
import { cn } from "@/lib/utils";

function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <div
      className="inline-flex items-center gap-1 whitespace-nowrap"
      aria-label={`${rating} out of 5 stars`}
    >
      <div className="flex items-center gap-0.5 text-accent">
        {[1, 2, 3, 4, 5].map((idx) => (
          <Star
            key={idx}
            className={cn(
              "h-3.5 w-3.5",
              idx <= rating ? "fill-accent text-accent" : "text-slate-300"
            )}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="ml-1 text-xs font-semibold text-text-primary tabular-nums">
        {rating}.0
      </span>
    </div>
  );
}

export function ReviewsClient() {
  const {
    tableMode,
    setTableMode,
    searchQuery,
    setSearchQuery,
    sortKey,
    sortDirection,
    handleSortChange,
    setCurrentPage,
    paginateRows,
  } = useAdminTableState({
    initialSortKey: "destinationName",
    pageSize: 5,
  });

  const [ratingFilter, setRatingFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [inspectReview, setInspectReview] =
    React.useState<AdminSampleReview | null>(null);
  const [moderateTarget, setModerateTarget] =
    React.useState<AdminSampleReview | null>(null);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    ratingFilter !== "all" ||
    statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setRatingFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
    setTableMode("data");
  };

  const pendingReviews = ADMIN_REVIEW_RECORDS.filter(
    (r) => r.status === "pending"
  ).length;
  const rejectedReviews = ADMIN_REVIEW_RECORDS.filter(
    (r) => r.status === "rejected"
  ).length;
  const avgScore = (
    ADMIN_REVIEW_RECORDS.reduce((acc, r) => acc + r.rating, 0) /
    ADMIN_REVIEW_RECORDS.length
  ).toFixed(1);

  const filteredReviews = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ADMIN_REVIEW_RECORDS.filter((rev) => {
      const matchesQuery =
        !query ||
        rev.destinationName.toLowerCase().includes(query) ||
        rev.reviewerName.toLowerCase().includes(query) ||
        rev.excerpt.toLowerCase().includes(query);
      const matchesRating =
        ratingFilter === "all" ||
        (ratingFilter === "5" && rev.rating === 5) ||
        (ratingFilter === "4" && rev.rating === 4) ||
        (ratingFilter === "low" && rev.rating <= 3);
      const matchesStatus =
        statusFilter === "all" || rev.status === statusFilter;
      return matchesQuery && matchesRating && matchesStatus;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortKey === "rating") {
        comparison = a.rating - b.rating;
      } else if (sortKey === "status") {
        comparison = a.status.localeCompare(b.status);
      } else {
        comparison = a.destinationName.localeCompare(b.destinationName);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [searchQuery, ratingFilter, statusFilter, sortKey, sortDirection]);

  const { totalPages, safePage, pageSize, paginatedRows } =
    paginateRows(filteredReviews);

  const columns: DataTableColumn<AdminSampleReview>[] = [
    {
      key: "destinationName",
      header: "Destination & Excerpt",
      mobileLabel: "Destination",
      mobileRole: "primary",
      sortable: true,
      cell: (row) => (
        <div className="md:min-w-[220px] md:max-w-[300px] space-y-1">
          <p className="font-semibold text-text-primary leading-snug">
            {row.destinationName}{" "}
            <span className="font-normal text-xs text-text-secondary">
              &bull; {row.region}
            </span>
          </p>
          <p
            title={row.excerpt}
            className="line-clamp-2 text-xs text-text-secondary leading-relaxed"
          >
            {row.excerpt}
          </p>
        </div>
      ),
    },
    {
      key: "reviewerName",
      header: "Reviewer",
      mobileRole: "secondary",
      cell: (row) => (
        <div className="flex items-center gap-2.5 md:whitespace-nowrap">
          <Avatar size="sm">
            <AvatarFallback>{row.reviewerInitials}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-text-primary">
            {row.reviewerName}
          </span>
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      mobileRole: "status",
      sortable: true,
      cell: (row) => <StarRatingDisplay rating={row.rating} />,
    },
    {
      key: "status",
      header: "Status",
      mobileRole: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: "submittedAt",
      header: "Date",
      mobileRole: "secondary",
      cell: (row) => (
        <span className="text-xs text-text-secondary md:whitespace-nowrap">
          {row.submittedAt}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Moderation",
      mobileRole: "actions",
      align: "right",
      cell: (row) => (
        <RowActionMenu
          rowLabel={`${row.reviewerName} review`}
          actions={[
            {
              id: "inspect",
              label: "Inspect Full Review",
              icon: Eye,
              onSelect: () => setInspectReview(row),
            },
            {
              id: "approve",
              label: "Approve Review (Placeholder)",
              icon: CheckCircle2,
              onSelect: () =>
                adminToast.info(
                  "Review Moderation Placeholder",
                  `Approval action for ${row.reviewerName}'s review is preview-only.`
                ),
            },
            {
              id: "reject",
              label: "Reject / Hide Review (Guard)",
              icon: Flag,
              destructive: true,
              separatorBefore: true,
              onSelect: () => setModerateTarget(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[{ label: "Reviews" }]}
        title="Review Management"
        description="Inspect traveler feedback, destination ratings, review moderation statuses, and non-functional moderation placeholders across Malappuram spots."
        badge={
          <Badge variant="accentSubtle" dot>
            {ADMIN_REVIEW_RECORDS.length} Sample Reviews
          </Badge>
        }
      />

      <AdminSampleBanner
        title="Review Moderation Queue (Preview Only):"
        description="Approve, inspect, and flag actions illustrate UI workflows using synthetic visitor feedback only."
      />

      {/* Review Statistics */}
      <section aria-labelledby="reviews-stats-heading">
        <h2 id="reviews-stats-heading" className="sr-only">
          Review statistics summary
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Sample Reviews"
            value={ADMIN_REVIEW_RECORDS.length}
            icon={MessageSquare}
            tone="primary"
            loading={tableMode === "loading"}
            footnote="Across Malappuram sample listings"
          />
          <StatCard
            title="Average Sample Rating"
            value={`${avgScore} / 5`}
            icon={Star}
            tone="secondary"
            loading={tableMode === "loading"}
            footnote="Derived from preview records"
          />
          <StatCard
            title="Pending Moderation"
            value={pendingReviews}
            icon={Clock}
            tone="accent"
            loading={tableMode === "loading"}
            footnote="Awaiting curator check"
          />
          <StatCard
            title="Flagged / Rejected"
            value={rejectedReviews}
            icon={Flag}
            tone="muted"
            loading={tableMode === "loading"}
            footnote="Held by moderation rules preview"
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Filter sample visitor reviews by rating tier or moderation status.
        </p>
        <AdminStateTabs value={tableMode} onValueChange={setTableMode} />
      </div>

      <Card>
        <CardContent className="p-3.5 sm:p-5 space-y-4 sm:space-y-5">
          <TableToolbar
            searchSlot={
              <AdminSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search destination, reviewer, comment..."
              />
            }
            filtersSlot={
              <TableFilterBar
                hasActiveFilters={hasActiveFilters}
                onResetFilters={handleResetFilters}
                filters={[
                  {
                    id: "review-rating-filter",
                    label: "Rating",
                    value: ratingFilter,
                    onValueChange: (val) => {
                      setRatingFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Ratings" },
                      { value: "5", label: "5 Stars" },
                      { value: "4", label: "4 Stars" },
                      { value: "low", label: "3 Stars & Below" },
                    ],
                  },
                  {
                    id: "review-status-filter",
                    label: "Review Status",
                    value: statusFilter,
                    onValueChange: (val) => {
                      setStatusFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Statuses" },
                      { value: "approved", label: "Approved" },
                      { value: "pending", label: "Pending" },
                      { value: "rejected", label: "Rejected" },
                    ],
                  },
                ]}
              />
            }
          />

          <DataTable
            caption="Malappuram traveler review moderation sample table"
            data={tableMode === "empty" ? [] : paginatedRows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => `${row.reviewerName} on ${row.destinationName}`}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            isLoading={tableMode === "loading"}
            errorMessage={
              tableMode === "error"
                ? "ERR_REVIEWS_PREVIEW_503: Simulated review feed retrieval failure."
                : undefined
            }
            onRetry={() => {
              setTableMode("data");
              adminToast.success(
                "Review Feed Restored",
                "Returned to sample reviews list."
              );
            }}
            emptyTitle="No matching reviews found"
            emptyDescription="Reset active rating or status filters to inspect sample reviews."
            emptyAction={
              <Button type="button" size="sm" onClick={handleResetFilters}>
                Reset Review Filters
              </Button>
            }
          />

          {tableMode === "data" && filteredReviews.length > 0 && (
            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredReviews.length}
              pageSize={pageSize}
              itemLabel="sample reviews"
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Full Review Inspection Modal */}
      <Dialog
        open={inspectReview !== null}
        onOpenChange={(open) => {
          if (!open) setInspectReview(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{inspectReview?.destinationName}</DialogTitle>
            <DialogDescription>
              Submitted by {inspectReview?.reviewerName} ({inspectReview?.submittedAt})
            </DialogDescription>
          </DialogHeader>

          {inspectReview && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-slate-50/70 p-3">
                <StarRatingDisplay rating={inspectReview.rating} />
                <StatusBadge status={inspectReview.status} size="sm" />
              </div>

              <div className="rounded-lg border border-border p-4 text-sm text-text-primary leading-relaxed">
                {inspectReview.excerpt}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInspectReview(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                setInspectReview(null);
                adminToast.info(
                  "Moderation Action Placeholder",
                  "Approve action is preview-only without persistence."
                );
              }}
            >
              Approve (Placeholder)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={moderateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setModerateTarget(null);
        }}
        title="Reject or hide sample review?"
        description="Confirmation dialog guard only. Moderation updates are excluded from Task 04."
        targetLabel={
          moderateTarget
            ? `${moderateTarget.reviewerName} — ${moderateTarget.destinationName}`
            : undefined
        }
        variant="destructive"
        confirmLabel="Reject Preview"
        onConfirm={() =>
          adminToast.info(
            "Moderation Guard Completed (Preview)",
            "Sample review status remains unchanged."
          )
        }
      />
    </div>
  );
}
