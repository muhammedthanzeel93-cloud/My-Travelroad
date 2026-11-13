"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  ShieldCheck,
  XCircle,
} from "lucide-react";
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
import { VerificationStatusBadge } from "@/components/admin/status/status-badge";
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
  ADMIN_VERIFICATION_RECORDS,
  type AdminSampleVerificationItem,
} from "@/data/admin-sample-data";

export function DestinationVerificationClient() {
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
    pageSize: 6,
  });

  const [verificationFilter, setVerificationFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [inspectItem, setInspectItem] =
    React.useState<AdminSampleVerificationItem | null>(null);
  const [decisionDialog, setDecisionDialog] = React.useState<{
    open: boolean;
    variant: "default" | "warning" | "destructive";
    title: string;
    description: string;
    targetLabel?: string;
    confirmLabel: string;
  }>({
    open: false,
    variant: "destructive",
    title: "",
    description: "",
    confirmLabel: "Confirm",
  });

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    verificationFilter !== "all" ||
    categoryFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setVerificationFilter("all");
    setCategoryFilter("all");
    setCurrentPage(1);
    setTableMode("data");
  };

  const pendingCount = ADMIN_VERIFICATION_RECORDS.filter(
    (item) =>
      item.verificationStatus === "in_review" ||
      item.verificationStatus === "unverified" ||
      item.verificationStatus === "needs_update"
  ).length;
  const verifiedCount = ADMIN_VERIFICATION_RECORDS.filter(
    (item) => item.verificationStatus === "verified"
  ).length;
  const rejectedCount = ADMIN_VERIFICATION_RECORDS.filter(
    (item) => item.verificationStatus === "flagged"
  ).length;

  const filteredQueue = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ADMIN_VERIFICATION_RECORDS.filter((row) => {
      const matchesQuery =
        !query ||
        row.destinationName.toLowerCase().includes(query) ||
        row.region.toLowerCase().includes(query) ||
        row.reviewerName.toLowerCase().includes(query);
      const matchesStatus =
        verificationFilter === "all" ||
        row.verificationStatus === verificationFilter;
      const matchesCategory =
        categoryFilter === "all" || row.category === categoryFilter;
      return matchesQuery && matchesStatus && matchesCategory;
    }).sort((a, b) => {
      const valA =
        sortKey === "verificationStatus"
          ? a.verificationStatus
          : sortKey === "reviewerName"
          ? a.reviewerName
          : a.destinationName;
      const valB =
        sortKey === "verificationStatus"
          ? b.verificationStatus
          : sortKey === "reviewerName"
          ? b.reviewerName
          : b.destinationName;
      const comparison = valA.localeCompare(valB);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    searchQuery,
    verificationFilter,
    categoryFilter,
    sortKey,
    sortDirection,
  ]);

  const { totalPages, safePage, pageSize, paginatedRows } =
    paginateRows(filteredQueue);

  const columns: DataTableColumn<AdminSampleVerificationItem>[] = [
    {
      key: "destinationName",
      header: "Submission (Sample)",
      mobileLabel: "Submission",
      mobileRole: "primary",
      sortable: true,
      cell: (row) => (
        <div className="md:min-w-[190px] space-y-0.5">
          <p className="font-semibold text-text-primary leading-snug">
            {row.destinationName}
          </p>
          <p className="text-xs text-text-secondary">
            {row.region} &bull; {row.category}
          </p>
        </div>
      ),
    },
    {
      key: "verificationStatus",
      header: "Verification Status",
      mobileLabel: "Verification",
      mobileRole: "status",
      sortable: true,
      cell: (row) => (
        <VerificationStatusBadge state={row.verificationStatus} size="sm" />
      ),
    },
    {
      key: "reviewerName",
      header: "Reviewer Info",
      mobileLabel: "Assigned Reviewer",
      mobileRole: "secondary",
      sortable: true,
      cell: (row) => (
        <div className="text-xs md:whitespace-nowrap">
          <p className="font-medium text-text-primary">{row.reviewerName}</p>
          <p className="text-[11px] text-text-secondary">{row.reviewerRole}</p>
        </div>
      ),
    },
    {
      key: "submittedAt",
      header: "Submitted",
      mobileRole: "secondary",
      cell: (row) => (
        <div className="text-xs text-text-secondary md:whitespace-nowrap">
          <span className="font-medium text-text-primary">{row.submittedAt}</span>
          <span className="block text-[11px]">By {row.submittedBy}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Review Actions",
      mobileRole: "actions",
      align: "right",
      cell: (row) => (
        <RowActionMenu
          rowLabel={row.destinationName}
          actions={[
            {
              id: "inspect",
              label: "Inspect Verification Notes",
              icon: Eye,
              onSelect: () => setInspectItem(row),
            },
            {
              id: "approve",
              label: "Approve (Placeholder)",
              icon: CheckCircle2,
              onSelect: () =>
                setDecisionDialog({
                  open: true,
                  variant: "default",
                  title: "Approve Verification (Preview)?",
                  description:
                    "Simulated approval dialog. Real verification state transitions are excluded in Task 04.",
                  targetLabel: row.destinationName,
                  confirmLabel: "Approve Preview",
                }),
            },
            {
              id: "changes",
              label: "Request Update (Placeholder)",
              icon: AlertTriangle,
              onSelect: () =>
                adminToast.warning(
                  "Request Changes Placeholder",
                  `Review checklist feedback triggered for ${row.destinationName}.`
                ),
            },
            {
              id: "reject",
              label: "Reject Submission (Guard)",
              icon: XCircle,
              destructive: true,
              separatorBefore: true,
              onSelect: () =>
                setDecisionDialog({
                  open: true,
                  variant: "destructive",
                  title: "Reject destination submission?",
                  description:
                    "Confirmation dialog protecting rejection decisions. Confirming displays sample toast feedback only.",
                  targetLabel: row.destinationName,
                  confirmLabel: "Reject Preview",
                }),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[{ label: "Destination Verification" }]}
        title="Destination Verification Queue"
        description="Inspect pending destination submissions, field verification status badges, assigned reviewers, and non-functional review decision placeholders."
        badge={
          <Badge variant="accentSubtle" dot>
            {pendingCount} Pending Queue
          </Badge>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              adminToast.info(
                "Verification Checklist (Preview)",
                "Standard checks: taluk location accuracy, safety signage, and category alignment."
              )
            }
          >
            <ClipboardCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Checklist Guidelines
          </Button>
        }
      />

      <AdminSampleBanner
        title="Verification Workflow Preview (No Decisions Persisted):"
        description="Review actions open inspection previews and confirmation dialogs without altering verification statuses in a backend."
      />

      {/* Queue Overview Stats */}
      <section aria-labelledby="ver-overview-heading">
        <h2 id="ver-overview-heading" className="sr-only">
          Verification queue overview
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Submissions"
            value={ADMIN_VERIFICATION_RECORDS.length}
            icon={ClipboardCheck}
            tone="primary"
            loading={tableMode === "loading"}
            footnote="Sample queue snapshot"
          />
          <StatCard
            title="Pending Submissions"
            value={pendingCount}
            icon={Clock}
            tone="accent"
            loading={tableMode === "loading"}
            footnote="In Review, Unverified & Needs Update"
          />
          <StatCard
            title="Verified Destinations"
            value={verifiedCount}
            icon={ShieldCheck}
            tone="secondary"
            loading={tableMode === "loading"}
            footnote="Sample verified benchmark"
          />
          <StatCard
            title="Rejected / Flagged"
            value={rejectedCount}
            icon={XCircle}
            tone="muted"
            loading={tableMode === "loading"}
            footnote="Held for duplicate or landmark check"
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Filter submissions by verification stage or test queue loading/empty
          states.
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
                placeholder="Search destination, reviewer, location..."
              />
            }
            filtersSlot={
              <TableFilterBar
                hasActiveFilters={hasActiveFilters}
                onResetFilters={handleResetFilters}
                filters={[
                  {
                    id: "ver-status-filter",
                    label: "Verification Status",
                    value: verificationFilter,
                    onValueChange: (val) => {
                      setVerificationFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Verification States" },
                      { value: "in_review", label: "In Review" },
                      { value: "needs_update", label: "Needs Update" },
                      { value: "unverified", label: "Unverified" },
                      { value: "verified", label: "Verified" },
                      { value: "flagged", label: "Flagged" },
                    ],
                  },
                  {
                    id: "ver-category-filter",
                    label: "Category",
                    value: categoryFilter,
                    onValueChange: (val) => {
                      setCategoryFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Categories" },
                      { value: "Nature & Forests", label: "Nature & Forests" },
                      { value: "Beaches & Estuaries", label: "Beaches & Estuaries" },
                      { value: "Waterfalls & Hills", label: "Waterfalls & Hills" },
                      { value: "Heritage & Culture", label: "Heritage & Culture" },
                    ],
                  },
                ]}
              />
            }
          />

          <DataTable
            caption="Malappuram destination verification queue sample table"
            data={tableMode === "empty" ? [] : paginatedRows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.destinationName}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            isLoading={tableMode === "loading"}
            errorMessage={
              tableMode === "error"
                ? "ERR_VERIFICATION_QUEUE_503: Simulated verification queue load failure."
                : undefined
            }
            onRetry={() => {
              setTableMode("data");
              adminToast.success(
                "Queue Restored",
                "Verification table preview restored."
              );
            }}
            emptyTitle="No submissions match queue filters"
            emptyDescription="Clear active verification filters to inspect sample Malappuram queue entries."
            emptyAction={
              <Button type="button" size="sm" onClick={handleResetFilters}>
                Reset Queue Filters
              </Button>
            }
          />

          {tableMode === "data" && filteredQueue.length > 0 && (
            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredQueue.length}
              pageSize={pageSize}
              itemLabel="queue submissions"
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Read-only Submission Review Notes Dialog */}
      <Dialog
        open={inspectItem !== null}
        onOpenChange={(open) => {
          if (!open) setInspectItem(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{inspectItem?.destinationName}</DialogTitle>
            <DialogDescription>
              {inspectItem?.region} &bull; {inspectItem?.category}
            </DialogDescription>
          </DialogHeader>

          {inspectItem && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-slate-50/70 p-3">
                <span className="text-xs font-medium text-text-secondary">
                  Current Status
                </span>
                <VerificationStatusBadge state={inspectItem.verificationStatus} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-text-secondary">Assigned Reviewer</p>
                  <p className="font-semibold text-text-primary">
                    {inspectItem.reviewerName}
                  </p>
                  <p className="text-text-secondary">{inspectItem.reviewerRole}</p>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-text-secondary">Submission Details</p>
                  <p className="font-semibold text-text-primary">
                    By {inspectItem.submittedBy}
                  </p>
                  <p className="text-text-secondary">{inspectItem.submittedAt}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-xs font-semibold text-text-primary">
                  Reviewer Notes (Sample)
                </p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {inspectItem.reviewNote}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setInspectItem(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                const label = inspectItem?.destinationName ?? "Submission";
                setInspectItem(null);
                adminToast.info(
                  "Verification Action Placeholder",
                  `Approve action for "${label}" is a non-functional UI preview.`
                );
              }}
            >
              Approve (Placeholder)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={decisionDialog.open}
        onOpenChange={(open) =>
          setDecisionDialog((prev) => ({ ...prev, open }))
        }
        title={decisionDialog.title}
        description={decisionDialog.description}
        targetLabel={decisionDialog.targetLabel}
        variant={decisionDialog.variant}
        confirmLabel={decisionDialog.confirmLabel}
        onConfirm={() =>
          adminToast.info(
            "Verification Decision Preview Only",
            `${decisionDialog.targetLabel ?? "Submission"} was not modified.`
          )
        }
      />
    </div>
  );
}
