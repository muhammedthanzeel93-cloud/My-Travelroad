import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Heart } from "lucide-react";
import { DEV_SAMPLE_DESTINATIONS } from "@/data/sample-data";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DestinationCard } from "@/components/tourism/destination-card";
import { SampleDataNotice } from "@/components/tourism/sample-data-notice";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Saved Destinations",
  description:
    "Structural page preview for saved destinations and empty saved state on My Travelroad.",
};

interface SavedPageProps {
  searchParams: {
    view?: string;
  };
}

export default function SavedPage({ searchParams }: SavedPageProps) {
  const isEmptyView = searchParams.view === "empty";
  const sampleSavedDestinations = DEV_SAMPLE_DESTINATIONS.filter(
    (dest) => dest.isSampleSaved
  );

  return (
    <PageContainer spacing="default" className="space-y-8">
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Saved Destinations" }]} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
              Saved Destinations
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary sm:text-base">
              Review the structural layout for a traveler&apos;s bookmarked Malappuram spots as well as the empty state for first-time visitors.
            </p>
          </div>

          {/* Structural View Switcher */}
          <div
            aria-label="Preview state switcher"
            className="inline-flex rounded-lg border border-border bg-surface p-1 shadow-subtle self-start sm:self-auto"
          >
            <Link
              href="/saved"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                !isEmptyView
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              Saved Layout ({sampleSavedDestinations.length})
            </Link>
            <Link
              href="/saved?view=empty"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isEmptyView
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              Empty State View
            </Link>
          </div>
        </div>
      </div>

      <SampleDataNotice
        title="Structural Preview Only"
        message="Bookmark persistence and account synchronization are excluded from Task 02. Switch tabs above to inspect both populated and empty saved states."
      />

      {isEmptyView ? (
        <EmptyState
          icon={Heart}
          title="No Saved Destinations Yet"
          description="You haven't bookmarked any Malappuram destinations yet. Explore forests, estuaries, and heritage stops to build your personal shortlist once saving is enabled."
          actionComponent={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/destinations">Explore Destinations</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/saved">View Sample Saved Grid</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <section aria-labelledby="saved-grid-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="saved-grid-heading"
              className="flex items-center gap-2 text-lg font-semibold text-text-primary"
            >
              <Bookmark className="h-4 w-4 text-primary" aria-hidden="true" />
              Sample Bookmarked Places
            </h2>
            <span className="text-xs text-text-secondary">
              Remove action is a structural placeholder
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sampleSavedDestinations.map((destination) => (
              <DestinationCard
                key={destination.slug}
                destination={destination}
                actionSlot={
                  <Badge variant="subtle" size="sm">
                    <Bookmark className="mr-1 h-3 w-3" aria-hidden="true" />
                    Saved (Placeholder)
                  </Badge>
                }
              />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
