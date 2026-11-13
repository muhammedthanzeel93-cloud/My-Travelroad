"use client";

import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSearch,
  Flag,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Users,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSampleBanner } from "@/components/admin/feedback/admin-sample-banner";
import { ConfirmDialog } from "@/components/admin/feedback/confirm-dialog";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import {
  ChartContainer,
  SampleBarBreakdown,
  SampleColumnChart,
} from "@/components/admin/dashboard/chart-container";
import { ActivitySummaryCard } from "@/components/admin/dashboard/activity-summary-card";
import { AdminSearchInput } from "@/components/admin/tables/admin-search-input";
import { TableFilterBar } from "@/components/admin/tables/table-filters";
import { TableToolbar } from "@/components/admin/tables/table-toolbar";
import { RowActionMenu } from "@/components/admin/tables/row-action-menu";
import { TablePagination } from "@/components/admin/tables/table-pagination";
import {
  AdminStateTabs,
  type AdminPreviewMode,
} from "@/components/admin/tables/admin-state-tabs";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/tables/data-table";
import { useAdminTableState } from "@/components/admin/tables/use-admin-table-state";
import {
  ADMIN_MODERATION_REPORTS,
  ADMIN_MODERATION_STATS,
  ADMIN_REPORT_PERIODS,
  type AdminReportStatus,
  type AdminReportType,
  type AdminSampleModerationReport,
  type AdminSampleStat,
} from "@/data/admin-sample-data";

const STAT_ICON_MAP: Record<AdminSampleStat["iconKey"], typeof MapPin> = {
  destinations: MapPin,
  pending: Clock,
  verified: CheckCircle2,
  users: Users,
};

function ReportStatusBadge({ status }: { status: AdminReportStatus }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="accentSubtle" dot size="sm">
          <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
          Pending
        </Badge>
      );
    case "in_review":
      return (
        <Badge variant="secondarySubtle" dot size="sm">
          <FileSearch className="mr-1 h-3 w-3" aria-hidden="true" />
          In Review
        </Badge>
      );
    case "resolved":
      return (
        <Badge variant="subtle" dot size="sm">
          <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
          Resolved
        </Badge>
      );
    case "dismissed":
      return (
        <Badge variant="muted" size="sm">
          <XCircle className="mr-1 h-3 w-3" aria-hidden="true" />
          Dismissed
        </Badge>
      );
  }
}

function ReportTypeBadge({ type, label }: { type: AdminReportType; label: string }) {
  switch (type) {
    case "content_flag":
      return (
        <Badge variant="destructive" size="sm">
          <Flag className="mr-1 h-3 w-3" aria-hidden="true" />
          {label}
        </Badge>
      );
    case "safety_concern":
      return (
        <Badge
          variant="outline"
          size="sm"
          className="border-red-300 bg-red-50/70 font-semibold text-red-800"
        >
          <AlertTriangle className="mr-1 h-3 w-3 text-red-600" aria-hidden="true" />
          {label}
        </Badge>
      );
    case "inaccurate_info":
      return (
        <Badge
          variant="outline"
          size="sm"
          className="border-amber-300 bg-amber-50/60 text-amber-800"
        >
          {label}
        </Badge>
      );
    case "outdated_details":
      return (
        <Badge
          variant="outline"
          size="sm"
          className="border-blue-200 bg-blue-50/60 text-blue-800"
        >
          {label}
        </Badge>
      );
    case "duplicate":
      return (
        <Badge variant="muted" size="sm">
          {label}
        </Badge>
      );
  }
}

function SeverityIndicator({ severity }: { severity: "high" | "medium" | "low" }) {
  switch (severity) {
    case "high":
      return (
        <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800">
          High
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
          Med
        </span>
      );
    case "low":
      return (
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
          Low
        </span>
      );
  }
}

export function ReportsClient() {
  const [activeTab, setActiveTab] = React.useState<"moderation" | "analytics">("moderation");
  const [dateRange, setDateRange] = React.useState<"7d" | "30d" | "90d">("30d");
  const [inspectReport, setInspectReport] =
    React.useState<AdminSampleModerationReport | null>(null);

  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    variant: "default" | "destructive" | "warning";
    title: string;
    description: string;
    targetLabel?: string;
    confirmLabel: string;
  }>({
    open: false,
    variant: "default",
    title: "",
    description: "",
    confirmLabel: "Confirm",
  });

  // Table state for Moderation Reports
  const {
    tableMode,
    setTableMode,
    searchQuery,
    setSearchQuery,
    sortKey,
    sortDirection,
    handleSortChange,
    currentPage,
    setCurrentPage,
    paginateRows,
  } = useAdminTableState({
    initialSortKey: "reportCode",
    pageSize: 5,
  });

  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const hasActiveFilters =
    searchQuery.trim() !== "" || typeFilter !== "all" || statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
    setTableMode("data");
  };

  const filteredReports = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ADMIN_MODERATION_REPORTS.filter((rep) => {
      const matchesQuery =
        !query ||
        rep.reportCode.toLowerCase().includes(query) ||
        rep.targetTitle.toLowerCase().includes(query) ||
        rep.reason.toLowerCase().includes(query) ||
        rep.reporterName.toLowerCase().includes(query);
      const matchesType = typeFilter === "all" || rep.type === typeFilter;
      const matchesStatus = statusFilter === "all" || rep.status === statusFilter;
      return matchesQuery && matchesType && matchesStatus;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortKey === "reportCode") {
        comparison = a.reportCode.localeCompare(b.reportCode);
      } else if (sortKey === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortKey === "severity") {
        const order = { high: 3, medium: 2, low: 1 };
        comparison = order[a.severity] - order[b.severity];
      } else {
        comparison = a.targetTitle.localeCompare(b.targetTitle);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [searchQuery, typeFilter, statusFilter, sortKey, sortDirection]);

  const { totalPages, safePage, pageSize, paginatedRows } =
    paginateRows(filteredReports);

  const activePeriod = ADMIN_REPORT_PERIODS[dateRange];

  const columns: DataTableColumn<AdminSampleModerationReport>[] = [
    {
      key: "reportCode",
      header: "Report ID",
      mobileRole: "primary",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-text-primary">
            {row.reportCode}
          </span>
          <SeverityIndicator severity={row.severity} />
        </div>
      ),
    },
    {
      key: "targetTitle",
      header: "Target / Type",
      mobileLabel: "Subject & Type",
      mobileRole: "primary",
      sortable: true,
      cell: (row) => (
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-primary line-clamp-1">
            {row.targetTitle}
          </p>
          <ReportTypeBadge type={row.type} label={row.typeLabel} />
        </div>
      ),
    },
    {
      key: "reason",
      header: "Report Reason / Summary",
      mobileLabel: "Reason",
      mobileRole: "description",
      cell: (row) => (
        <p className="text-xs text-text-secondary line-clamp-2 md:max-w-md">
          {row.reason}
        </p>
      ),
    },
    {
      key: "reporter",
      header: "Reporter",
      mobileLabel: "Submitted By",
      mobileRole: "secondary",
      cell: (row) => (
        <div className="text-xs text-text-secondary md:whitespace-nowrap">
          <span className="font-medium text-text-primary">{row.reporterName}</span>
          <span className="block text-[11px] text-text-secondary">
            {row.submittedAt}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobileRole: "status",
      sortable: true,
      cell: (row) => <ReportStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      mobileRole: "actions",
      align: "right",
      cell: (row) => (
        <RowActionMenu
          rowLabel={row.reportCode}
          actions={[
            {
              id: "inspect",
              label: "Inspect Report Details",
              icon: Eye,
              onSelect: () => setInspectReport(row),
            },
            {
              id: "in_review",
              label: "Mark In Review (Preview)",
              icon: FileSearch,
              onSelect: () =>
                adminToast.info(
                  "Status Updated (Preview)",
                  `${row.reportCode} assigned to curator investigation queue.`
                ),
            },
            {
              id: "resolve",
              label: "Resolve Report",
              icon: CheckCircle2,
              onSelect: () =>
                setConfirmDialog({
                  open: true,
                  variant: "default",
                  title: `Mark ${row.reportCode} as Resolved?`,
                  description:
                    "Confirms that required listing corrections or content moderation have been applied. No backend mutation occurs in preview mode.",
                  targetLabel: row.targetTitle,
                  confirmLabel: "Mark Resolved",
                }),
            },
            {
              id: "dismiss",
              label: "Dismiss Report",
              icon: XCircle,
              destructive: true,
              separatorBefore: true,
              onSelect: () =>
                setConfirmDialog({
                  open: true,
                  variant: "destructive",
                  title: `Dismiss ${row.reportCode}?`,
                  description:
                    "Flags this report as invalid or duplicate. The target entity will remain unchanged.",
                  targetLabel: row.targetTitle,
                  confirmLabel: "Dismiss Report",
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
        breadcrumbs={[{ label: "Reports & Moderation" }]}
        title="Reports & Moderation"
        description="Review community reports, triage inaccurate destination details, and explore Malappuram tourism growth analytics."
        badge={
          <Badge variant="accentSubtle" dot>
            6 Sample Reports • {activePeriod.label}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === "analytics" && (
              <Select
                value={dateRange}
                onValueChange={(value) =>
                  setDateRange(value as "7d" | "30d" | "90d")
                }
              >
                <SelectTrigger
                  aria-label="Select sample report date range"
                  className="h-9 w-full xs:w-[205px] bg-surface text-xs sm:text-sm"
                >
                  <Calendar
                    className="mr-1.5 h-3.5 w-3.5 text-text-secondary shrink-0"
                    aria-hidden="true"
                  />
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days (Sample)</SelectItem>
                  <SelectItem value="30d">Last 30 Days (Sample)</SelectItem>
                  <SelectItem value="90d">Last 90 Days (Sample)</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                adminToast.info(
                  "Export Report (Placeholder)",
                  `Sample report export for "${activePeriod.label}" requires backend APIs.`
                )
              }
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          </div>
        }
      />

      <AdminSampleBanner
        title="Reports & Moderation Workspace (Sample Data):"
        description="Browse moderation reports, inspect community flags, or view regional tourism telemetry. All actions and exports are structural UI previews."
      />

      {/* Primary Tab Navigation: Moderation Queue vs Analytics */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "moderation" | "analytics")}
        className="w-full"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="moderation" className="gap-1.5 text-xs sm:text-sm">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Moderation Queue
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Analytics & Trends
            </TabsTrigger>
          </TabsList>

          <AdminStateTabs value={tableMode} onValueChange={setTableMode} />
        </div>

        {/* TAB 1: MODERATION QUEUE */}
        {activeTab === "moderation" && (
          <div className="mt-6 space-y-6">
            {/* 1. Report Summary Cards */}
            <section aria-labelledby="mod-stats-heading">
              <h2 id="mod-stats-heading" className="sr-only">
                Moderation summary metrics
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {ADMIN_MODERATION_STATS.map((stat) => (
                  <StatCard
                    key={stat.id}
                    title={stat.title}
                    value={stat.value}
                    icon={STAT_ICON_MAP[stat.iconKey]}
                    tone={stat.tone}
                    loading={tableMode === "loading"}
                    change={{
                      value: stat.delta,
                      trend: stat.trend,
                      periodLabel: stat.periodLabel,
                    }}
                  />
                ))}
              </div>
            </section>

            {/* 2. Moderation Reports Table & Filters */}
            <Card>
              <CardContent className="space-y-4 p-3.5 sm:p-5">
                <TableToolbar
                  searchSlot={
                    <AdminSearchInput
                      placeholder="Search by code, target, reason, or reporter..."
                      value={searchQuery}
                      onChange={(query) => {
                        setSearchQuery(query);
                        setCurrentPage(1);
                      }}
                    />
                  }
                  filtersSlot={
                    <TableFilterBar
                      hasActiveFilters={hasActiveFilters}
                      onResetFilters={handleResetFilters}
                      filters={[
                        {
                          id: "rep-type-filter",
                          label: "Report Type",
                          value: typeFilter,
                          onValueChange: (val: string) => {
                            setTypeFilter(val);
                            setCurrentPage(1);
                          },
                          options: [
                            { value: "all", label: "All Types" },
                            { value: "inaccurate_info", label: "Inaccurate Info" },
                            { value: "content_flag", label: "Content Flag" },
                            { value: "outdated_details", label: "Outdated Info" },
                            { value: "safety_concern", label: "Safety Concern" },
                            { value: "duplicate", label: "Duplicate" },
                          ],
                        },
                        {
                          id: "rep-status-filter",
                          label: "Status",
                          value: statusFilter,
                          onValueChange: (val: string) => {
                            setStatusFilter(val);
                            setCurrentPage(1);
                          },
                          options: [
                            { value: "all", label: "All Statuses" },
                            { value: "pending", label: "Pending" },
                            { value: "in_review", label: "In Review" },
                            { value: "resolved", label: "Resolved" },
                            { value: "dismissed", label: "Dismissed" },
                          ],
                        },
                      ]}
                    />
                  }
                />

                <DataTable
                  caption="Malappuram moderation reports table"
                  data={tableMode === "empty" ? [] : paginatedRows}
                  columns={columns}
                  getRowId={(row) => row.id}
                  getRowLabel={(row) => `${row.reportCode} — ${row.targetTitle}`}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                  isLoading={tableMode === "loading"}
                  errorMessage={
                    tableMode === "error"
                      ? "ERR_REPORTS_MOD_503: Simulated moderation report load error."
                      : undefined
                  }
                  onRetry={() => {
                    setTableMode("data");
                    adminToast.success(
                      "Reports Restored",
                      "Returned to sample moderation report queue."
                    );
                  }}
                  emptyTitle="No reports match your filters"
                  emptyDescription="Try clearing active search or status filters to view sample moderation items."
                  emptyAction={
                    <Button type="button" size="sm" onClick={handleResetFilters}>
                      Reset Filters
                    </Button>
                  }
                />

                {tableMode === "data" && filteredReports.length > 0 && (
                  <TablePagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    totalItems={filteredReports.length}
                    pageSize={pageSize}
                    itemLabel="sample reports"
                    onPageChange={setCurrentPage}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: ANALYTICS & TRENDS */}
        {activeTab === "analytics" && (
          <div className="mt-6 space-y-6">
            {/* 1. Analytics Overview Statistics */}
            <section aria-labelledby="reports-analytics-stats">
              <h2 id="reports-analytics-stats" className="sr-only">
                Analytics overview stats
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {activePeriod.summaryStats.map((stat) => (
                  <StatCard
                    key={stat.id}
                    title={stat.title}
                    value={stat.value}
                    icon={STAT_ICON_MAP[stat.iconKey]}
                    tone={stat.tone}
                    loading={tableMode === "loading"}
                    change={{
                      value: stat.delta,
                      trend: stat.trend,
                      periodLabel: stat.periodLabel,
                    }}
                  />
                ))}
              </div>
            </section>

            {/* 2. Destination Growth & Category Distribution */}
            <section
              aria-labelledby="reports-growth-heading"
              className="grid grid-cols-1 gap-6 lg:grid-cols-12"
            >
              <h2 id="reports-growth-heading" className="sr-only">
                Destination growth and category distribution
              </h2>

              <div className="lg:col-span-7">
                <ChartContainer
                  title="Destination Growth (Sample)"
                  description={`Submissions vs. verified entries across ${activePeriod.label.toLowerCase()}.`}
                  badgeText="CSS Token Chart"
                  isLoading={tableMode === "loading"}
                  isEmpty={tableMode === "empty"}
                  errorMessage={
                    tableMode === "error"
                      ? "ERR_REPORTS_GROWTH_503: Simulated chart dataset unavailable."
                      : undefined
                  }
                  onRetry={() => {
                    setTableMode("data");
                    adminToast.success(
                      "Reports Restored",
                      "Sample growth telemetry restored."
                    );
                  }}
                  footerNote="Placeholder bars built with Task 01 Primary (#166534) & Secondary (#0F766E) tokens."
                >
                  <SampleColumnChart
                    points={activePeriod.growthSeries}
                    primaryLabel="Submissions (Sample)"
                    secondaryLabel="Verified (Sample)"
                  />
                </ChartContainer>
              </div>

              <div className="lg:col-span-5">
                <ChartContainer
                  title="Category Distribution (Sample)"
                  description="Relative destination density by Malappuram category."
                  badgeText={activePeriod.label}
                  isLoading={tableMode === "loading"}
                  isEmpty={tableMode === "empty"}
                  errorMessage={
                    tableMode === "error"
                      ? "ERR_REPORTS_CATEGORY_503: Simulated category summary failure."
                      : undefined
                  }
                  onRetry={() => setTableMode("data")}
                  footerNote="Sample proportions — not derived from live analytics."
                >
                  <SampleBarBreakdown items={activePeriod.categoryDistribution} />
                </ChartContainer>
              </div>
            </section>

            {/* 3. Verification Statistics & User Activity */}
            <section
              aria-labelledby="reports-ver-heading"
              className="grid grid-cols-1 gap-6 lg:grid-cols-12"
            >
              <h2 id="reports-ver-heading" className="sr-only">
                Verification statistics and user activity
              </h2>

              <div className="lg:col-span-5">
                <ChartContainer
                  title="Verification Statistics (Sample)"
                  description="Breakdown of queue completions vs. items awaiting updates."
                  badgeText="Moderation Mix"
                  isLoading={tableMode === "loading"}
                  isEmpty={tableMode === "empty"}
                  errorMessage={
                    tableMode === "error"
                      ? "ERR_REPORTS_VER_503: Simulated verification stats error."
                      : undefined
                  }
                  onRetry={() => setTableMode("data")}
                  footerNote="Sample verification status mix across Malappuram districts."
                >
                  <SampleBarBreakdown items={activePeriod.verificationBreakdown} />
                </ChartContainer>
              </div>

              <div className="lg:col-span-7">
                <ActivitySummaryCard
                  title="Recent User & Curator Activity"
                  description="Chronological sample summary of submission and verification events."
                  badgeText="Sample Feed"
                  isLoading={tableMode === "loading"}
                  items={tableMode === "empty" ? [] : activePeriod.userActivityFeed}
                />
              </div>
            </section>
          </div>
        )}
      </Tabs>

      {/* Inspect Report Modal */}
      <Dialog
        open={inspectReport !== null}
        onOpenChange={(open) => {
          if (!open) setInspectReport(null);
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-text-primary">
                {inspectReport?.reportCode}
              </span>
              {inspectReport && (
                <>
                  <SeverityIndicator severity={inspectReport.severity} />
                  <ReportStatusBadge status={inspectReport.status} />
                </>
              )}
            </div>
            <DialogTitle className="text-base sm:text-lg">
              {inspectReport?.targetTitle}
            </DialogTitle>
            <DialogDescription>
              Community moderation report regarding{" "}
              {inspectReport?.targetType === "destination"
                ? "destination listing"
                : "user review"}
              .
            </DialogDescription>
          </DialogHeader>

          {inspectReport && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-border bg-slate-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-text-secondary">Report Category</span>
                  <ReportTypeBadge
                    type={inspectReport.type}
                    label={inspectReport.typeLabel}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-text-secondary">Submitted By</span>
                  <span className="font-semibold text-text-primary">
                    {inspectReport.reporterName} ({inspectReport.reporterEmail})
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-text-secondary">Timestamp</span>
                  <span className="text-text-primary">{inspectReport.submittedAt}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Reporter Reason
                </h4>
                <p className="text-sm font-medium text-text-primary">
                  {inspectReport.reason}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Full Description & Context
                </h4>
                <p className="rounded border border-border bg-surface p-3 text-xs leading-relaxed text-text-secondary">
                  {inspectReport.details}
                </p>
              </div>

              <div className="rounded border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900">
                <strong>Curator Preview Note:</strong> Taking action or dismissing this report
                updates visual status in local preview state. Database mutations are excluded in Task 04.
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInspectReport(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    const code = inspectReport.reportCode;
                    setInspectReport(null);
                    setConfirmDialog({
                      open: true,
                      variant: "destructive",
                      title: `Dismiss ${code}?`,
                      description: "Flags this report as resolved without content mutation.",
                      confirmLabel: "Dismiss Report",
                    });
                  }}
                >
                  Dismiss Report
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const code = inspectReport.reportCode;
                    setInspectReport(null);
                    adminToast.success(
                      "Moderation Action Applied (Preview)",
                      `${code} marked as resolved with curator notes.`
                    );
                  }}
                >
                  Resolve & Update
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Guard Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
        title={confirmDialog.title}
        description={confirmDialog.description}
        targetLabel={confirmDialog.targetLabel}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={() =>
          adminToast.info(
            "Moderation Action Previewed",
            `${confirmDialog.confirmLabel} recorded in local session state.`
          )
        }
      />
    </div>
  );
}
