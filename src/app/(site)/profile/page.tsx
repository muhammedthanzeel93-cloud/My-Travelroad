import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Clock,
  Compass,
  MapPin,
  Settings,
  UserCheck,
} from "lucide-react";
import { DEV_SAMPLE_PROFILE } from "@/data/sample-data";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SampleDataNotice } from "@/components/tourism/sample-data-notice";

export const metadata: Metadata = {
  title: "User Profile",
  description:
    "Structural traveler profile layout, placeholder statistics, and activity timeline on My Travelroad.",
};

export default function ProfilePage() {
  return (
    <PageContainer spacing="default" className="space-y-8">
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Profile" }]} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
              Traveler Profile
            </h1>
            <p className="mt-2 text-sm text-text-secondary sm:text-base">
              Account overview, placeholder statistics, and recent exploration structure.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign In Layout</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/saved">View Saved</Link>
            </Button>
          </div>
        </div>
      </div>

      <SampleDataNotice
        title="Profile Layout Placeholder"
        message="Authentication, account persistence, and real user metrics are excluded from Task 02. All displayed details represent a static preview structure."
      />

      {/* Profile Information Layout */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar size="xl" status="online">
                <AvatarFallback>{DEV_SAMPLE_PROFILE.initials}</AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-text-primary sm:text-2xl">
                    {DEV_SAMPLE_PROFILE.displayName}
                  </h2>
                  <Badge variant="subtle" size="sm">
                    <UserCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                    {DEV_SAMPLE_PROFILE.memberStatusLabel}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                  <span>{DEV_SAMPLE_PROFILE.handle}</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {DEV_SAMPLE_PROFILE.homeRegion}
                  </span>
                </div>

                <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
                  {DEV_SAMPLE_PROFILE.bioPlaceholder}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-1.5 sm:items-end shrink-0">
              <Button variant="outline" disabled aria-disabled="true">
                <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit Profile (Placeholder)
              </Button>
              <span className="text-[11px] text-text-secondary">
                Account settings disabled in Task 02
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Statistics Placeholders */}
      <section aria-labelledby="profile-stats-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="profile-stats-heading"
            className="text-xl font-bold tracking-tight text-text-primary"
          >
            Activity Summary (Placeholders)
          </h2>
          <Badge variant="muted" size="sm">
            Static Layout Metrics
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DEV_SAMPLE_PROFILE.statsPlaceholders.map((stat, idx) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                  <span>{stat.label}</span>
                  {idx === 0 ? (
                    <Bookmark className="h-4 w-4 text-primary" aria-hidden="true" />
                  ) : idx === 1 ? (
                    <Compass className="h-4 w-4 text-secondary" aria-hidden="true" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold text-text-primary">{stat.value}</p>
                <p className="mt-1 text-xs text-text-secondary">{stat.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* User Activity Structure */}
      <section aria-labelledby="profile-activity-heading" className="space-y-4">
        <h2
          id="profile-activity-heading"
          className="text-xl font-bold tracking-tight text-text-primary"
        >
          Recent Discovery Activity (Structure Preview)
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sample Activity Timeline</CardTitle>
            <CardDescription>
              Demonstrates how recent browsing and bookmark actions will render once user sessions exist.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {DEV_SAMPLE_PROFILE.activityPlaceholders.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-primary">
                    {activity.title}
                  </p>
                  <p className="text-xs text-text-secondary">{activity.subtitle}</p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-center">
                  <Badge variant="muted" size="sm">
                    {activity.timestampLabel}
                  </Badge>
                  <Button variant="ghost" size="sm" asChild className="text-primary">
                    <Link href={activity.targetHref}>
                      Open <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  );
}
