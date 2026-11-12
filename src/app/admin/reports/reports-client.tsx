"use client";

import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSampleBanner } from "@/components/admin/feedback/admin-sample-banner";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import {
  ChartContainer,
  SampleBarBreakdown,
  SampleColumnChart,
} from "@/components/admin/dashboard/chart-container";
import { ActivitySummaryCard } from "@/components/admin/dashboard/activity-summary-card";
import {
  AdminStateTabs,
  type AdminPreviewMode,
} from "@/components/admin/tables/admin-state-tabs";
import {
  ADMIN_REPORT_PERIODS,
  type AdminSampleStat,
} from "@/data/admin-sample-data";

const REPORT_ICON_MAP: Record<AdminSampleStat["iconKey"], typeof MapPin> = {
  destinations: MapPin,
  pending: Clock,
  verified: CheckCircle2,
  users: Users,
};

export function ReportsClient() {
  const [dateRange, setDateRange] = React.useState<"7d" | "30d" | "90d">("30d");
  const [viewMode, setViewMode] = React.useState<AdminPreviewMode>("data");

  const activePeriod = ADMIN_REPORT_PERIODS[dateRange];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[{ label: "Reports" }]}
        title="Reports & Analytics"
        description="Structural analytics layout displaying clearly labeled sample destination growth, category distribution, verification ratios, and user activity."
        badge={
          <Badge variant="accentSubtle" dot>
            {activePeriod.label}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              value={dateRange}
              onValueChange={(value) =>
                setDateRange(value as "7d" | "30d" | "90d")
              }
            >
              <SelectTrigger
                aria-label="Select sample report date range"
                className="h-9 w-[205px] bg-surface text-xs sm:text-sm"
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

            <Button
              type="button"
              size="sm"
              onClick={() =>
                adminToast.info(
                  "Export Report (Placeholder)",
                  `Sample CSV/PDF export for "${activePeriod.label}" requires backend report APIs.`
                )
              }
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Export Report
            </Button>
          </div>
        }
      />

      <AdminSampleBanner
        title="Sample Analytics Only (No External APIs):"
        description="Switching the date range updates in-memory Task 04 preview figures locally. All metrics and charts are illustrative UI placeholders."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Inspect report containers across populated, loading, empty, and error
          states.
        </p>
        <AdminStateTabs value={viewMode} onValueChange={setViewMode} />
      </div>

      {/* 1. Overview Statistics */}
      <section aria-labelledby="reports-stats-heading">
        <h2 id="reports-stats-heading" className="sr-only">
          Sample analytics overview metrics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {activePeriod.summaryStats.map((stat) => (
            <StatCard
              key={stat.id}
              title={stat.title}
              value={stat.value}
              icon={REPORT_ICON_MAP[stat.iconKey]}
              tone={stat.tone}
              loading={viewMode === "loading"}
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
            isLoading={viewMode === "loading"}
            isEmpty={viewMode === "empty"}
            errorMessage={
              viewMode === "error"
                ? "ERR_REPORTS_GROWTH_503: Simulated chart dataset unavailable."
                : undefined
            }
            onRetry={() => {
              setViewMode("data");
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
            isLoading={viewMode === "loading"}
            isEmpty={viewMode === "empty"}
            errorMessage={
              viewMode === "error"
                ? "ERR_REPORTS_CATEGORY_503: Simulated category summary failure."
                : undefined
            }
            onRetry={() => setViewMode("data")}
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
            isLoading={viewMode === "loading"}
            isEmpty={viewMode === "empty"}
            errorMessage={
              viewMode === "error"
                ? "ERR_REPORTS_VER_503: Simulated verification stats error."
                : undefined
            }
            onRetry={() => setViewMode("data")}
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
            isLoading={viewMode === "loading"}
            items={viewMode === "empty" ? [] : activePeriod.userActivityFeed}
          />
        </div>
      </section>
    </div>
  );
}
