"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  FolderCheck,
  Info,
  Layers,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Palette,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ADMIN_SAMPLE_ACTIVITY,
  ADMIN_SAMPLE_DISTRIBUTION,
  ADMIN_SAMPLE_ROWS,
  ADMIN_SAMPLE_STATS,
  type AdminSampleDestinationRow,
} from "@/data/admin-sample-data";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import {
  ChartContainer,
  SampleBarBreakdown,
} from "@/components/admin/dashboard/chart-container";
import { ActivitySummaryCard } from "@/components/admin/dashboard/activity-summary-card";
import {
  ActiveBadge,
  ApprovedBadge,
  InactiveBadge,
  PendingBadge,
  RejectedBadge,
  StatusBadge,
  SuspendedBadge,
  VerificationStatusBadge,
} from "@/components/admin/status/status-badge";
import { AdminSearchInput } from "@/components/admin/tables/admin-search-input";
import { TableFilterBar } from "@/components/admin/tables/table-filters";
import { TableToolbar } from "@/components/admin/tables/table-toolbar";
import { BulkSelectionBar } from "@/components/admin/tables/bulk-selection-checkbox";
import { RowActionMenu } from "@/components/admin/tables/row-action-menu";
import { TablePagination } from "@/components/admin/tables/table-pagination";
import {
  DataTable,
  type DataTableColumn,
  type SortDirection,
} from "@/components/admin/tables/data-table";
import {
  AdminFormActions,
  AdminFormSection,
} from "@/components/admin/forms/admin-form-section";
import {
  AdminCheckboxField,
  AdminRadioGroupField,
  AdminSelectField,
  AdminSwitchField,
  AdminTextField,
  AdminTextareaField,
} from "@/components/admin/forms/admin-form-fields";
import { ConfirmDialog } from "@/components/admin/feedback/confirm-dialog";
import { AdminDropdownMenu } from "@/components/admin/feedback/admin-dropdown-menu";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import {
  AdminChartSkeleton,
  AdminStatCardSkeleton,
} from "@/components/admin/feedback/admin-skeleton";
import { AdminEmptyState } from "@/components/admin/feedback/admin-empty-state";
import { AdminErrorState } from "@/components/admin/feedback/admin-error-state";

interface TokenSwatch {
  name: string;
  token: string;
  hex: string;
  usage: string;
  swatchClass: string;
  border?: boolean;
}

const ADMIN_COLOR_TOKENS: TokenSwatch[] = [
  {
    name: "Primary",
    token: "--primary / bg-primary",
    hex: "#166534",
    usage: "Primary actions, active sidebar state, positive trends",
    swatchClass: "bg-primary",
  },
  {
    name: "Primary Hover",
    token: "--primary-hover",
    hex: "#14532D",
    usage: "Hover & pressed button states",
    swatchClass: "bg-primary-hover",
  },
  {
    name: "Secondary",
    token: "--secondary / bg-secondary",
    hex: "#0F766E",
    usage: "Verification highlights, approved pills, estuary tags",
    swatchClass: "bg-secondary",
  },
  {
    name: "Accent",
    token: "--accent / bg-accent",
    hex: "#F59E0B",
    usage: "Unread notice dot, pending review indicators",
    swatchClass: "bg-accent",
  },
  {
    name: "Background",
    token: "--background / bg-background",
    hex: "#F8FAFC",
    usage: "Main workspace canvas behind surface cards",
    swatchClass: "bg-background",
    border: true,
  },
  {
    name: "Surface",
    token: "--surface / bg-surface",
    hex: "#FFFFFF",
    usage: "Sidebar, top bar, cards, data tables, dialogs",
    swatchClass: "bg-surface",
    border: true,
  },
  {
    name: "Primary Text",
    token: "--text-primary",
    hex: "#172033",
    usage: "Headings, table values, metric numbers",
    swatchClass: "bg-text-primary",
  },
  {
    name: "Secondary Text",
    token: "--text-secondary",
    hex: "#64748B",
    usage: "Column headers, captions, helper text",
    swatchClass: "bg-text-secondary",
  },
  {
    name: "Border",
    token: "--border / border-border",
    hex: "#E2E8F0",
    usage: "Card outlines, table row dividers, control borders",
    swatchClass: "bg-border",
    border: true,
  },
  {
    name: "Destructive",
    token: "destructive",
    hex: "#DC2626",
    usage: "Rejected states, error validation, confirm-delete CTAs",
    swatchClass: "bg-destructive",
  },
];

const TYPOGRAPHY_SPECIMENS = [
  {
    label: "Admin Page Title (H1)",
    spec: "24px / 30px • Bold • tracking-tight",
    sample: "Malappuram Directory Administration",
    sampleClass: "text-2xl sm:text-3xl font-bold tracking-tight text-text-primary",
  },
  {
    label: "Section Heading (H2)",
    spec: "20px • Bold • tracking-tight",
    sample: "Verification Queue & Category Breakdown",
    sampleClass: "text-xl font-bold tracking-tight text-text-primary",
  },
  {
    label: "Card / Panel Title (H3)",
    spec: "18px • Semibold",
    sample: "Sample Destinations Registry",
    sampleClass: "text-lg font-semibold text-text-primary",
  },
  {
    label: "KPI Metric Value",
    spec: "30px • Extrabold • tabular-nums",
    sample: "24 / 18 Verified",
    sampleClass: "text-3xl font-extrabold tracking-tight text-text-primary tabular-nums",
  },
  {
    label: "Body & Table Cell",
    spec: "14px • Regular / Medium",
    sample: "Nilambur Teak Reserve (Sample) — Eastern Malappuram",
    sampleClass: "text-sm font-medium text-text-primary",
  },
  {
    label: "Table Header / Section Label",
    spec: "12px • Semibold • Uppercase • tracking-wider",
    sample: "VERIFICATION STATUS • LAST UPDATED",
    sampleClass: "text-xs font-semibold uppercase tracking-wider text-text-secondary",
  },
];

const STAT_ICONS = {
  destinations: MapPin,
  pending: Clock,
  verified: ShieldCheck,
  users: Users,
};

const PAGE_SIZE = 5;

type TablePreviewMode = "data" | "loading" | "empty" | "error";

export function AdminDesignSystemClient() {
  // Dashboard preview toggles
  const [kpiLoading, setKpiLoading] = React.useState(false);

  // Table workbench states
  const [tableMode, setTableMode] = React.useState<TablePreviewMode>("data");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<string>("name");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>(["dest-01"]);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Form showcase states
  const [placeTitle, setPlaceTitle] = React.useState(
    "Nilambur Conolly Corridor (Sample)"
  );
  const [slugInput, setSlugInput] = React.useState("Invalid Slug Format!");
  const [regionSelect, setRegionSelect] = React.useState("nilambur");
  const [summaryNotes, setSummaryNotes] = React.useState(
    "Sample editorial guidance note placeholder for Malappuram curators."
  );
  const [visibilityMode, setVisibilityMode] = React.useState("review");
  const [featuredToggle, setFeaturedToggle] = React.useState(true);
  const [confirmVerifyCheck, setConfirmVerifyCheck] = React.useState(true);

  // Confirmation dialog state
  const [confirmState, setConfirmState] = React.useState<{
    open: boolean;
    variant: "default" | "warning" | "destructive";
    title: string;
    description: string;
    targetLabel?: string;
    confirmLabel: string;
  }>({
    open: false,
    variant: "destructive",
    title: "Confirm Destructive Action?",
    description:
      "This confirmation pattern guards delete, reject, or suspend workflows.",
    confirmLabel: "Confirm Action",
  });

  const filteredRows = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = ADMIN_SAMPLE_ROWS.filter((row) => {
      const matchesQuery =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.region.toLowerCase().includes(q) ||
        row.submittedBy.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      const matchesCategory =
        categoryFilter === "all" || row.category === categoryFilter;
      return matchesQuery && matchesStatus && matchesCategory;
    });

    const sorted = [...filtered].sort((a, b) => {
      const valueA = String(
        sortKey === "category"
          ? a.category
          : sortKey === "status"
          ? a.status
          : a.name
      );
      const valueB = String(
        sortKey === "category"
          ? b.category
          : sortKey === "status"
          ? b.status
          : b.name
      );
      return sortDirection === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    });

    return sorted;
  }, [searchQuery, statusFilter, categoryFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleSortChange = (columnKey: string) => {
    if (sortKey === columnKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(columnKey);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const openConfirmDemo = (config: typeof confirmState) => {
    setConfirmState(config);
  };

  const columns: DataTableColumn<AdminSampleDestinationRow>[] = [
    {
      key: "name",
      header: "Destination (Sample)",
      mobileLabel: "Destination",
      mobileRole: "primary",
      sortable: true,
      cell: (row) => (
        <div className="md:min-w-[175px]">
          <p className="font-semibold text-text-primary">{row.name}</p>
          <p className="text-xs text-text-secondary">{row.region}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      mobileRole: "secondary",
      sortable: true,
      cell: (row) => (
        <span className="md:whitespace-nowrap text-xs font-medium text-text-secondary">
          {row.category}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobileRole: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: "verification",
      header: "Verification",
      mobileRole: "status",
      cell: (row) => (
        <VerificationStatusBadge state={row.verificationStatus} size="sm" />
      ),
    },
    {
      key: "curator",
      header: "Curator / Updated",
      mobileLabel: "Curator & Updated",
      mobileRole: "secondary",
      cell: (row) => (
        <div className="md:whitespace-nowrap text-xs">
          <p className="font-medium text-text-primary">{row.submittedBy}</p>
          <p className="text-text-secondary">{row.updatedAt}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      mobileRole: "actions",
      align: "right",
      widthClassName: "w-[72px]",
      cell: (row) => (
        <RowActionMenu
          rowLabel={row.name}
          actions={[
            {
              id: "inspect",
              label: "Inspect Row (Preview)",
              icon: Eye,
              onSelect: () =>
                adminToast.info(
                  `Inspecting "${row.name}"`,
                  "Detail editing belongs to a future admin management task."
                ),
            },
            {
              id: "edit",
              label: "Edit Placeholder",
              icon: Pencil,
              onSelect: () =>
                adminToast.placeholder(`Edit "${row.name}"`),
            },
            {
              id: "flag",
              label: "Flag for Verification",
              icon: Flag,
              onSelect: () =>
                openConfirmDemo({
                  open: true,
                  variant: "warning",
                  title: "Flag sample entry for review?",
                  description:
                    "Confirmation preview before marking a destination for curator re-verification.",
                  targetLabel: row.name,
                  confirmLabel: "Flag Entry (Preview)",
                }),
            },
            {
              id: "delete",
              label: "Delete Entry",
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              onSelect: () =>
                openConfirmDemo({
                  open: true,
                  variant: "destructive",
                  title: "Delete sample listing?",
                  description:
                    "Destructive actions always require explicit confirmation. Confirming here triggers preview feedback only.",
                  targetLabel: row.name,
                  confirmLabel: "Delete (Preview)",
                }),
            },
          ]}
        />
      ),
    },
  ];

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    categoryFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setCurrentPage(1);
    setTableMode("data");
  };

  return (
    <div className="space-y-10 pb-8">
      {/* Page Header & Development Preview Notice */}
      <AdminPageHeader
        breadcrumbs={[{ label: "UI Foundation" }, { label: "Design System" }]}
        title="Admin UI Design System"
        description="Reusable dashboard, data table, status badge, form, and confirmation components for My Travelroad administrators — built on Task 01 tokens and Lucide icons."
        badge={
          <Badge variant="accentSubtle" dot>
            Task 03 Preview Only
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/design-system">User Design System</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                adminToast.success(
                  "Admin Foundation Ready",
                  "Sample notification triggered from AdminPageHeader action."
                )
              }
            >
              <Bell className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Test Toast
            </Button>
          </>
        }
      />

      <div
        role="status"
        className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm shadow-subtle sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-2.5 sm:items-center">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-secondary sm:mt-0"
            aria-hidden="true"
          />
          <p className="text-text-secondary">
            <span className="font-semibold text-text-primary">
              Development-Only Preview:{" "}
            </span>
            Metrics, table records, sidebar module tabs, and dialogs demonstrate
            UI behavior on in-memory sample data only. Auth, DB, and CRUD APIs
            are excluded.
          </p>
        </div>
        <Badge variant="muted" size="sm" className="self-start sm:self-center shrink-0">
          Sample Data Only
        </Badge>
      </div>

      {/* 1. Admin Colour Palette */}
      <section aria-labelledby="admin-colors-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2
            id="admin-colors-heading"
            className="text-xl font-bold tracking-tight text-text-primary"
          >
            1. Admin Colour Palette (Reused Tokens)
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {ADMIN_COLOR_TOKENS.map((item) => (
            <Card key={item.name} className="overflow-hidden">
              <div
                className={`h-16 w-full ${item.swatchClass} ${
                  item.border ? "border-b border-border" : ""
                }`}
              />
              <CardHeader className="p-4 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">
                    {item.name}
                  </CardTitle>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-text-primary">
                    {item.hex}
                  </code>
                </div>
                <p className="text-[11px] font-mono text-text-secondary">
                  {item.token}
                </p>
                <CardDescription className="text-xs leading-snug pt-0.5">
                  {item.usage}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* 2. Admin Typography Scale & Layout Shell Summary */}
      <section
        aria-labelledby="admin-typography-heading"
        className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      >
        <Card className="lg:col-span-7">
          <CardHeader className="border-b border-border/70">
            <CardTitle id="admin-typography-heading" className="text-lg">
              2. Typography Hierarchy (Inter)
            </CardTitle>
            <CardDescription>
              Clear scan hierarchy with tabular numerals for counts, metrics,
              and table columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {TYPOGRAPHY_SPECIMENS.map((item) => (
              <div key={item.label} className="px-6 py-4 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                  <span className="font-semibold text-primary">{item.label}</span>
                  <span className="font-mono">{item.spec}</span>
                </div>
                <p className={item.sampleClass}>{item.sample}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LayoutDashboard className="h-5 w-5 text-secondary" aria-hidden="true" />
                3. Shell, Sidebar &amp; Header
              </CardTitle>
              <Badge variant="subtle" size="sm">
                Live Above &amp; Left
              </Badge>
            </div>
            <CardDescription>
              The full responsive admin shell wraps this preview route.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-3 text-sm text-text-secondary">
            <div className="rounded-lg border border-border bg-slate-50/70 p-3.5 space-y-1.5">
              <p className="font-semibold text-text-primary">
                Collapsible Sidebar Navigation
              </p>
              <p className="text-xs leading-relaxed">
                Includes all 8 future modules (Overview, Destinations, Categories,
                Destination Verification, Users, Reviews, Reports, Settings) tagged{" "}
                <span className="font-medium text-text-primary">Planned</span> plus{" "}
                <span className="font-medium text-primary">Admin Design System</span>.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-slate-50/70 p-3.5 space-y-1.5">
              <p className="font-semibold text-text-primary">
                Header Notifications &amp; Account Menu
              </p>
              <p className="text-xs leading-relaxed">
                Sticky header houses the notification bell dropdown, curator avatar
                menu, Sign Out confirmation demo, and mobile slide-over drawer trigger
                below <code className="font-mono">1024px</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Dashboard KPIs, Chart Container & Activity Summary */}
      <section aria-labelledby="admin-dashboard-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="admin-dashboard-heading"
              className="text-xl font-bold tracking-tight text-text-primary"
            >
              4. Dashboard Statistics, Chart Container &amp; Activity Summary
            </h2>
            <p className="text-sm text-text-secondary">
              Toggle skeleton loading to inspect asynchronous KPI and chart shimmer states.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setKpiLoading((prev) => !prev)}
          >
            {kpiLoading ? "Show Sample Metrics" : "Preview Loading State"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ADMIN_SAMPLE_STATS.map((stat) => (
            <StatCard
              key={stat.id}
              title={stat.title}
              value={stat.value}
              icon={STAT_ICONS[stat.iconKey]}
              tone={stat.tone}
              loading={kpiLoading}
              change={{
                value: stat.delta,
                trend: stat.trend,
                periodLabel: stat.periodLabel,
              }}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <ChartContainer
              title="Category Distribution (Sample)"
              description="Structural chart container with header controls, progress bars, and state fallbacks."
              badgeText="Non-Analytical Placeholder"
              isLoading={kpiLoading}
              footerNote="Sample proportions represent Malappuram preview categories only."
            >
              <SampleBarBreakdown items={ADMIN_SAMPLE_DISTRIBUTION} />
            </ChartContainer>
          </div>

          <div className="lg:col-span-6">
            <ActivitySummaryCard
              title="Recent Curation Activity (Sample)"
              description="Chronological admin event list pairing actor attribution with status badges."
              badgeText="Sample Feed"
              items={ADMIN_SAMPLE_ACTIVITY}
              isLoading={kpiLoading}
              footerAction={
                <span className="text-xs text-text-secondary">
                  Audit feed persistence belongs to a later backend task.
                </span>
              }
            />
          </div>
        </div>
      </section>

      {/* 5. Status & Verification Badges */}
      <section aria-labelledby="admin-status-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-secondary" aria-hidden="true" />
          <h2
            id="admin-status-heading"
            className="text-xl font-bold tracking-tight text-text-primary"
          >
            5. Status &amp; Verification Badges
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lifecycle Status Badges</CardTitle>
              <CardDescription>
                Named semantic badges rendered from one unified configuration map.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <ActiveBadge />
              <InactiveBadge />
              <PendingBadge />
              <ApprovedBadge />
              <RejectedBadge />
              <SuspendedBadge />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Destination Verification Status Badges
              </CardTitle>
              <CardDescription>
                Dedicated moderation &amp; field-verification queue badges.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <VerificationStatusBadge state="verified" />
              <VerificationStatusBadge state="in_review" />
              <VerificationStatusBadge state="needs_update" />
              <VerificationStatusBadge state="unverified" />
              <VerificationStatusBadge state="flagged" />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 6. Data Table, Toolbar, Search, Filters, Bulk Select & Pagination */}
      <section aria-labelledby="admin-table-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="admin-table-heading"
              className="text-xl font-bold tracking-tight text-text-primary"
            >
              6. Data Table, Search, Filters &amp; Pagination
            </h2>
            <p className="text-sm text-text-secondary">
              Interactive client-side preview over 8 sample Malappuram rows with
              bulk selection, sortable headers, row menu actions, and state switching.
            </p>
          </div>

          <Tabs
            value={tableMode}
            onValueChange={(value) => setTableMode(value as TablePreviewMode)}
            className="w-full sm:w-auto shrink-0"
          >
            <TabsList className="w-full sm:w-auto max-w-full overflow-x-auto">
              <TabsTrigger value="data" className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 text-xs sm:text-sm">
                Populated
              </TabsTrigger>
              <TabsTrigger value="loading" className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 text-xs sm:text-sm">
                Loading
              </TabsTrigger>
              <TabsTrigger value="empty" className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 text-xs sm:text-sm">
                Empty
              </TabsTrigger>
              <TabsTrigger value="error" className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 text-xs sm:text-sm">
                Error
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card>
          <CardContent className="p-3.5 sm:p-5 space-y-4 sm:space-y-5">
            <TableToolbar
              searchSlot={
                <AdminSearchInput
                  value={searchQuery}
                  onChange={(val) => {
                    setSearchQuery(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Search sample destination, region, curator..."
                />
              }
              filtersSlot={
                <TableFilterBar
                  hasActiveFilters={hasActiveFilters}
                  onResetFilters={handleResetFilters}
                  filters={[
                    {
                      id: "status-filter",
                      label: "Filter by Status",
                      value: statusFilter,
                      onValueChange: (val) => {
                        setStatusFilter(val);
                        setCurrentPage(1);
                      },
                      options: [
                        { value: "all", label: "All Statuses" },
                        { value: "active", label: "Active" },
                        { value: "approved", label: "Approved" },
                        { value: "pending", label: "Pending" },
                        { value: "inactive", label: "Inactive" },
                        { value: "rejected", label: "Rejected" },
                        { value: "suspended", label: "Suspended" },
                      ],
                    },
                    {
                      id: "category-filter",
                      label: "Filter by Category",
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
              bulkSelectionSlot={
                <BulkSelectionBar
                  selectedCount={selectedIds.length}
                  onClearSelection={() => setSelectedIds([])}
                  actions={
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        openConfirmDemo({
                          open: true,
                          variant: "destructive",
                          title: `Archive ${selectedIds.length} selected sample rows?`,
                          description:
                            "Demonstrates bulk confirmation protection. Confirming triggers toast feedback without altering data.",
                          targetLabel: `${selectedIds.length} checked sample rows`,
                          confirmLabel: "Archive Selected (Preview)",
                        })
                      }
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Archive Selected
                    </Button>
                  }
                />
              }
            />

            <DataTable
              caption="Sample Malappuram admin destinations table"
              data={tableMode === "empty" ? [] : paginatedRows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.name}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              isLoading={tableMode === "loading"}
              errorMessage={
                tableMode === "error"
                  ? "ERR_SAMPLE_FETCH: Simulated table retrieval failure"
                  : undefined
              }
              onRetry={() => {
                setTableMode("data");
                adminToast.success(
                  "Sample table restored",
                  "Retry callback switched view back to populated sample data."
                );
              }}
              emptyAction={
                <Button type="button" size="sm" onClick={handleResetFilters}>
                  Restore Sample Rows
                </Button>
              }
            />

            {tableMode === "data" && (
              <TablePagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={filteredRows.length}
                pageSize={PAGE_SIZE}
                itemLabel="sample rows"
                onPageChange={setCurrentPage}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* 7. Admin Form Elements & Dropdown Preview */}
      <section aria-labelledby="admin-forms-heading" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="admin-forms-heading"
              className="text-xl font-bold tracking-tight text-text-primary"
            >
              7. Admin Form Elements &amp; Dropdown Menu
            </h2>
            <p className="text-sm text-text-secondary">
              Labeled field wrappers reusing Task 01 form controls with consistent
              helper copy and validation states.
            </p>
          </div>

          <AdminDropdownMenu
            label="Quick Utility Menu"
            items={[
              {
                id: "export",
                label: "Export Sample CSV",
                icon: FolderCheck,
                shortcut: "Ctrl+E",
                onSelect: () =>
                  adminToast.info("Export Preview", "Download requires backend endpoints."),
              },
              {
                id: "approve",
                label: "Verify All Drafts",
                icon: CheckCircle2,
                onSelect: () =>
                  openConfirmDemo({
                    open: true,
                    variant: "default",
                    title: "Run bulk verification preview?",
                    description:
                      "Non-destructive confirmation dialog example for batch operations.",
                    confirmLabel: "Run Preview",
                  }),
              },
              {
                id: "purge",
                label: "Purge Archived Drafts",
                icon: Trash2,
                destructive: true,
                separatorBefore: true,
                onSelect: () =>
                  openConfirmDemo({
                    open: true,
                    variant: "destructive",
                    title: "Purge archived drafts?",
                    description:
                      "Destructive confirmation guard triggered from standalone dropdown menu.",
                    confirmLabel: "Confirm Purge",
                  }),
              },
            ]}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <MoreHorizontal className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Standalone Dropdown Menu
              </Button>
            }
          />
        </div>

        <AdminFormSection
          title="Sample Destination Metadata Form (UI Only)"
          description="Demonstrates Text Input (valid & error states), Select, Textarea, Radio Group, Checkbox, and Switch inside AdminFormSection."
          badge={
            <Badge variant="muted" size="sm">
              No Submission Backend
            </Badge>
          }
          footer={
            <AdminFormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  adminToast.info(
                    "Form Reset Preview",
                    "Form inputs are local client state only in Task 03."
                  )
                }
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() =>
                  adminToast.success(
                    "Form Pattern Verified",
                    "Actual save persistence belongs to destination management tasks."
                  )
                }
              >
                Save Sample Layout
              </Button>
            </AdminFormActions>
          }
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <AdminTextField
              id="admin-place-title"
              label="Destination Display Title"
              required
              value={placeTitle}
              onChange={(e) => setPlaceTitle(e.target.value)}
              description="Concise public heading displayed across discovery cards."
            />

            <AdminTextField
              id="admin-slug-error-demo"
              label="URL Slug (Validation Error Example)"
              required
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              errorMessage="Use lowercase letters, numbers, and hyphens only (e.g. nilambur-reserve)."
            />

            <AdminSelectField
              id="admin-region-select"
              label="Malappuram Taluk / Region"
              required
              value={regionSelect}
              onValueChange={setRegionSelect}
              description="Structured geographic grouping filter."
              options={[
                { value: "nilambur", label: "Nilambur (Eastern Corridor)" },
                { value: "kadalundi", label: "Kadalundi / Tirurangadi Coast" },
                { value: "perinthalmanna", label: "Perinthalmanna Uplands" },
                { value: "kottakkal", label: "Kottakkal Central Heritage" },
                { value: "ponnani", label: "Ponnani Estuary Zone" },
              ]}
            />

            <AdminSwitchField
              id="admin-featured-switch"
              label="Feature on Discovery Home"
              description="Structural switch control for spotlight placement."
              checked={featuredToggle}
              onCheckedChange={setFeaturedToggle}
            />
          </div>

          <AdminTextareaField
            id="admin-summary-notes"
            label="Curator Editorial Notes"
            value={summaryNotes}
            onChange={(e) => setSummaryNotes(e.target.value)}
            description="Multiline guidance notes visible to verification reviewers."
          />

          <AdminRadioGroupField
            id="admin-visibility-radio"
            label="Publication Review State (Sample Radio Group)"
            value={visibilityMode}
            onValueChange={setVisibilityMode}
            options={[
              {
                value: "review",
                label: "Send to Verification Queue",
                description: "Assigns pending status until curator checks fields.",
              },
              {
                value: "draft",
                label: "Keep in Draft Workspace",
                description: "Remains hidden from public Malappuram listings.",
              },
            ]}
          />

          <AdminCheckboxField
            id="admin-verify-checkbox"
            label="Confirmed source attribution checklist (Structural Placeholder)"
            description="Requires editorial verification before publishing in production tasks."
            checked={confirmVerifyCheck}
            onCheckedChange={setConfirmVerifyCheck}
          />
        </AdminFormSection>
      </section>

      {/* 8. Dialogs, Toasts & Standalone Feedback States */}
      <section aria-labelledby="admin-feedback-heading" className="space-y-4">
        <h2
          id="admin-feedback-heading"
          className="text-xl font-bold tracking-tight text-text-primary"
        >
          8. Confirmation Dialogs, Toast Notifications &amp; Feedback States
        </h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Confirmation Dialog Triggers
              </CardTitle>
              <CardDescription>
                Required confirmation guard before destructive or irreversible admin actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  openConfirmDemo({
                    open: true,
                    variant: "default",
                    title: "Publish Sample Preview Confirmation?",
                    description:
                      "Standard confirmation dialog variant using My Travelroad primary styling.",
                    targetLabel: "Nilambur Teak Reserve (Sample)",
                    confirmLabel: "Confirm Publish",
                  })
                }
              >
                Standard Confirm Dialog
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() =>
                  openConfirmDemo({
                    open: true,
                    variant: "destructive",
                    title: "Delete Destination Draft?",
                    description:
                      "Destructive confirmation guard preventing accidental deletion without user verification.",
                    targetLabel: "Unverified Roadside Marker (Sample)",
                    confirmLabel: "Delete Draft",
                  })
                }
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Destructive Confirm Dialog
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Toast Notification Variants
              </CardTitle>
              <CardDescription>
                Triggers Sonner toasts styled with Task 01 semantic left accents.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2.5">
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  adminToast.success(
                    "Record Approved (Sample)",
                    "Destination preview marked approved in local UI."
                  )
                }
              >
                Success Toast
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  adminToast.info(
                    "Verification Queue Note",
                    "Curator checklist updated (sample preview)."
                  )
                }
              >
                Info Toast
              </Button>
              <Button
                type="button"
                size="sm"
                variant="accent"
                onClick={() =>
                  adminToast.warning(
                    "Incomplete Coordinates",
                    "Sample warning before publishing destination."
                  )
                }
              >
                Warning Toast
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() =>
                  adminToast.error(
                    "Action Blocked (Sample)",
                    "Simulated error toast for failed validation."
                  )
                }
              >
                Error Toast
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loading Skeleton State</CardTitle>
              <CardDescription>
                Standalone AdminStatCardSkeleton &amp; AdminChartSkeleton preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AdminStatCardSkeleton />
              <AdminChartSkeleton />
            </CardContent>
          </Card>

          <AdminEmptyState
            title="Empty Queue State"
            description="No verification requests are pending review in this sample queue."
            actionLabel="Reload Sample Preview"
            onAction={() =>
              adminToast.info(
                "Sample Queue Reloaded",
                "Empty state action handler executed cleanly."
              )
            }
          />

          <AdminErrorState
            title="Admin Data Error State"
            description="Failed to retrieve moderation telemetry preview. Retry to recover safely."
            errorMessage="ERR_ADMIN_PREVIEW_503"
            onRetry={() =>
              adminToast.success(
                "Error Recovery Triggered",
                "Retry action invoked on AdminErrorState."
              )
            }
          />
        </div>
      </section>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((prev) => ({ ...prev, open }))}
        variant={confirmState.variant}
        title={confirmState.title}
        description={confirmState.description}
        targetLabel={confirmState.targetLabel}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={() => {
          adminToast.info(
            "Confirmation Acknowledged (Preview Only)",
            "No sample records were mutated in Task 03."
          );
        }}
      />
    </div>
  );
}
