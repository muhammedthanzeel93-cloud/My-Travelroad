"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FolderTree,
  MapPin,
  MessageSquare,
  Palette,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSampleBanner } from "@/components/admin/feedback/admin-sample-banner";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import {
  ChartContainer,
  SampleBarBreakdown,
} from "@/components/admin/dashboard/chart-container";
import { ActivitySummaryCard } from "@/components/admin/dashboard/activity-summary-card";
import {
  StatusBadge,
  VerificationStatusBadge,
} from "@/components/admin/status/status-badge";
import {
  ADMIN_OVERVIEW_STATS,
  ADMIN_RECENT_SUBMISSIONS,
  ADMIN_SAMPLE_ACTIVITY,
  ADMIN_SAMPLE_DISTRIBUTION,
  type AdminSampleStat,
} from "@/data/admin-sample-data";

const STAT_ICON_MAP: Record<AdminSampleStat["iconKey"], typeof MapPin> = {
  destinations: MapPin,
  pending: Clock,
  verified: CheckCircle2,
  users: Users,
};

const QUICK_LINKS = [
  {
    href: "/admin/destinations",
    label: "Manage Destinations",
    description: "Browse sample listings, filter statuses, and inspect entries.",
    icon: MapPin,
  },
  {
    href: "/admin/destination-verification",
    label: "Verification Queue",
    description: "Inspect pending Malappuram curation submissions & reviewer notes.",
    icon: ShieldCheck,
  },
  {
    href: "/admin/categories",
    label: "Category Directory",
    description: "Review regional nature, estuary, hill, and heritage groups.",
    icon: FolderTree,
  },
  {
    href: "/admin/reviews",
    label: "Moderate Reviews",
    description: "Preview visitor comments, star scores, and status badges.",
    icon: MessageSquare,
  },
  {
    href: "/admin/reports",
    label: "Reports & Analytics",
    description: "Explore range selectors, sample growth charts, and exports.",
    icon: BarChart3,
  },
  {
    href: "/admin/design-system",
    label: "Admin Design System",
    description: "Inspect reusable Task 03 tokens, tables, and form primitives.",
    icon: Palette,
  },
];

export function AdminOverviewClient() {
  const [showSkeletons, setShowSkeletons] = React.useState(false);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        breadcrumbs={[{ label: "Overview" }]}
        title="Welcome to Malappuram Admin Console"
        description="Monitor sample tourism discovery records, destination verification activity, category balance, and curator shortcuts across My Travelroad."
        badge={
          <Badge variant="accentSubtle" dot>
            Task 04 UI Preview
          </Badge>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSkeletons((prev) => !prev)}
            >
              {showSkeletons ? "Show Sample Data" : "Preview Loading"}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/destination-verification">
                <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Verification Queue
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/destinations">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Manage Destinations
              </Link>
            </Button>
          </>
        }
      />

      <AdminSampleBanner
        title="Overview Workspace (Development Sample Data):"
        description="Statistics, recent Malappuram submissions, verification logs, and quick navigation represent UI structure only. No database or live telemetry is connected."
      />

      {/* 1. Overview KPI Statistics */}
      <section aria-labelledby="overview-stats-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="overview-stats-heading"
            className="text-lg font-bold tracking-tight text-text-primary"
          >
            Platform Overview Metrics (Sample)
          </h2>
          <Badge variant="muted" size="sm">
            4 KPI Cards
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ADMIN_OVERVIEW_STATS.map((stat) => (
            <StatCard
              key={stat.id}
              title={stat.title}
              value={stat.value}
              icon={STAT_ICON_MAP[stat.iconKey]}
              tone={stat.tone}
              loading={showSkeletons}
              change={{
                value: stat.delta,
                trend: stat.trend,
                periodLabel: stat.periodLabel,
              }}
            />
          ))}
        </div>
      </section>

      {/* 2. Recent Destination Submissions & Recent Verification Activity */}
      <section
        aria-labelledby="overview-activity-heading"
        className="grid grid-cols-1 gap-6 xl:grid-cols-12"
      >
        <h2 id="overview-activity-heading" className="sr-only">
          Recent submissions and verification activity
        </h2>

        <Card className="flex flex-col xl:col-span-7">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/70 pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base sm:text-lg">
                  Recent Destination Submissions
                </CardTitle>
                <Badge variant="muted" size="sm">
                  Sample Queue
                </Badge>
              </div>
              <CardDescription>
                Latest Malappuram listings submitted for curator inspection.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0 text-primary">
              <Link href="/admin/destinations">
                View All
                <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="flex-1 p-0">
            <ul className="divide-y divide-border">
              {ADMIN_RECENT_SUBMISSIONS.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {entry.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {entry.region} &bull; {entry.category} &bull; By{" "}
                      {entry.submittedBy}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <StatusBadge status={entry.status} size="sm" />
                    <VerificationStatusBadge
                      state={entry.verificationStatus}
                      size="sm"
                    />
                    <span className="text-[11px] text-text-secondary whitespace-nowrap">
                      {entry.updatedAt}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>

          <CardFooter className="border-t border-border/60 bg-slate-50/60 px-6 py-3 text-xs text-text-secondary">
            Displaying 4 recent sample destination submissions (non-persistent preview).
          </CardFooter>
        </Card>

        <div className="xl:col-span-5">
          <ActivitySummaryCard
            title="Recent Verification Activity"
            description="Sample verification reviews & taxonomy checks."
            badgeText="Live Layout"
            isLoading={showSkeletons}
            items={ADMIN_SAMPLE_ACTIVITY}
            footerAction={
              <Button variant="ghost" size="sm" asChild className="text-primary px-0">
                <Link href="/admin/destination-verification">
                  Open Verification Queue
                  <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </div>
      </section>

      {/* 3. Category Distribution & Quick Actions */}
      <section
        aria-labelledby="overview-bottom-heading"
        className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      >
        <h2 id="overview-bottom-heading" className="sr-only">
          Category distribution and quick actions
        </h2>

        <div className="lg:col-span-6">
          <ChartContainer
            title="Category Distribution (Sample)"
            description="Malappuram listing balance across primary discovery categories."
            badgeText="4 Active Groups"
            isLoading={showSkeletons}
            headerAction={
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/categories">Manage Categories</Link>
              </Button>
            }
            footerNote="Proportions reflect static Task 04 sample distribution data."
          >
            <SampleBarBreakdown items={ADMIN_SAMPLE_DISTRIBUTION} />
          </ChartContainer>
        </div>

        <Card className="flex flex-col lg:col-span-6">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/70 pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base sm:text-lg">
                  Quick Actions
                </CardTitle>
                <Badge variant="subtle" size="sm">
                  Shortcuts
                </Badge>
              </div>
              <CardDescription>
                Jump directly into core admin pages or test placeholder notifications.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                adminToast.info(
                  "Add Destination Placeholder",
                  "Open Destinations to inspect the non-persistent Add Destination UI dialog."
                )
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              New Listing Notice
            </Button>
          </CardHeader>

          <CardContent className="grid flex-1 grid-cols-1 gap-3 pt-5 sm:grid-cols-2">
            {QUICK_LINKS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-primary">
                      {action.label}
                    </p>
                    <p className="text-xs text-text-secondary leading-snug">
                      {action.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
