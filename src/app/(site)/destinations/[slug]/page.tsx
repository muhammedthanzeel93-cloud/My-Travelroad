import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Bookmark,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  Info,
  Map as MapIcon,
  MapPin,
  Navigation,
  Ticket,
} from "lucide-react";
import {
  DEV_SAMPLE_DESTINATIONS,
  getCategoryBySlug,
  getDestinationBySlug,
  getRelatedDestinations,
} from "@/data/sample-data";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoryIcon } from "@/components/tourism/category-icon";
import { DestinationCard } from "@/components/tourism/destination-card";
import { SampleDataNotice } from "@/components/tourism/sample-data-notice";

interface DestinationDetailPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return DEV_SAMPLE_DESTINATIONS.map((dest) => ({ slug: dest.slug }));
}

export function generateMetadata({
  params,
}: DestinationDetailPageProps): Metadata {
  const destination = getDestinationBySlug(params.slug);
  if (!destination) {
    return {
      title: "Destination Not Found",
    };
  }
  return {
    title: destination.title,
    description: destination.shortDescription,
  };
}

export default function DestinationDetailPage({
  params,
}: DestinationDetailPageProps) {
  const destination = getDestinationBySlug(params.slug);

  if (!destination) {
    notFound();
  }

  const category = getCategoryBySlug(destination.categorySlug);
  const relatedDestinations = getRelatedDestinations(destination, 3);

  return (
    <PageContainer spacing="default" className="space-y-10">
      {/* Breadcrumb */}
      <Breadcrumbs
        items={[
          { label: "Destinations", href: "/destinations" },
          ...(category
            ? [{ label: category.name, href: `/categories/${category.slug}` }]
            : []),
          { label: destination.title },
        ]}
      />

      <SampleDataNotice message="This destination detail page displays development sample layout copy and structural action placeholders. Verified visitor fees, timings, and map tiles will be added in future tasks." />

      {/* Title, Location & Save Action Placeholder */}
      <header className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <Link href={`/categories/${category.slug}`}>
                <Badge variant={category.accentVariant}>{category.name}</Badge>
              </Link>
            )}
            <Badge variant="muted" size="sm">
              {destination.region}
            </Badge>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
            {destination.title}
          </h1>

          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span>{destination.location}</span>
          </div>
        </div>

        {/* Save Destination Action Placeholder */}
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-surface p-4 sm:flex-row sm:items-center lg:items-end lg:flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled aria-disabled="true">
              <Bookmark className="mr-2 h-4 w-4" aria-hidden="true" />
              Save Destination (Placeholder)
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/saved">View Saved Layout</Link>
            </Button>
          </div>
          <p className="text-xs text-text-secondary">
            Structural placeholder — bookmarking requires backend &amp; auth integration.
          </p>
        </div>
      </header>

      {/* Destination Image Gallery Structure */}
      <section aria-labelledby="gallery-heading" className="space-y-3">
        <h2 id="gallery-heading" className="sr-only">
          Destination Image Gallery
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Primary Image Placeholder */}
          <div className="flex aspect-[16/9] flex-col items-center justify-center rounded-2xl border border-border bg-primary/10 p-6 text-center lg:col-span-8 lg:aspect-auto lg:min-h-[340px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-primary shadow-subtle">
              <CategoryIcon iconKey={destination.iconKey} className="h-7 w-7" />
            </div>
            <p className="mt-3 text-sm font-semibold text-text-primary">
              {destination.gallerySlots[0]}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-text-secondary">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              Primary Showcase Photography Container
            </span>
          </div>

          {/* Secondary Thumbnail Slots */}
          <div className="grid grid-cols-3 gap-3 lg:col-span-4 lg:grid-cols-1">
            {destination.gallerySlots.slice(1).map((slotLabel, idx) => (
              <div
                key={slotLabel}
                className="flex min-h-[100px] flex-col items-center justify-center rounded-xl border border-border bg-surface p-3 text-center shadow-subtle"
              >
                <Camera className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                <p className="mt-1.5 text-xs font-medium text-text-primary line-clamp-2">
                  {slotLabel}
                </p>
                <span className="text-[11px] text-text-secondary">Slot {idx + 2}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Split: Description + Important Info + Map Placeholder */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Description & Highlights */}
        <div className="space-y-8 lg:col-span-7">
          <section aria-labelledby="description-heading" className="space-y-3">
            <h2
              id="description-heading"
              className="text-2xl font-bold tracking-tight text-text-primary"
            >
              Overview &amp; Description
            </h2>
            <p className="text-base leading-relaxed text-text-primary">
              {destination.shortDescription}
            </p>
            <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
              {destination.fullDescription}
            </p>
          </section>

          <section aria-labelledby="highlights-heading" className="space-y-3">
            <h3
              id="highlights-heading"
              className="text-lg font-semibold text-text-primary"
            >
              Experience Highlights (Sample Structure)
            </h3>
            <ul className="space-y-2.5 rounded-xl border border-border bg-surface p-5 shadow-subtle">
              {destination.highlightsPlaceholder.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-2.5 text-sm text-text-primary"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right Column: Important Information + Map/Location Placeholder */}
        <div className="space-y-6 lg:col-span-5">
          {/* Important Information Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info className="h-5 w-5 text-secondary" aria-hidden="true" />
                  Important Information
                </CardTitle>
                <Badge variant="muted" size="sm">
                  Placeholder
                </Badge>
              </div>
              <CardDescription>
                Structured visitor guidance template (sample text only).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 border-b border-border/60 pb-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Visiting Hours
                  </p>
                  <p className="text-sm font-medium text-text-primary">
                    {destination.importantInfoPlaceholder.visitingHours}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-b border-border/60 pb-3">
                <Compass className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Access &amp; Approach
                  </p>
                  <p className="text-sm font-medium text-text-primary">
                    {destination.importantInfoPlaceholder.accessNote}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-b border-border/60 pb-3">
                <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Entry &amp; Permits
                  </p>
                  <p className="text-sm font-medium text-text-primary">
                    {destination.importantInfoPlaceholder.entryReference}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Traveler Advisory
                  </p>
                  <p className="text-sm font-medium text-text-primary">
                    {destination.importantInfoPlaceholder.advisoryNote}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map / Location Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                Location &amp; Map Placeholder
              </CardTitle>
              <CardDescription>
                Map tile rendering and routing links will connect in a future phase.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex aspect-[16/10] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 p-5 text-center">
                <MapPin className="h-8 w-8 text-primary" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  Interactive Map Frame Placeholder
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {destination.mapPlaceholder.coordinatesLabel}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {destination.mapPlaceholder.nearestTownLabel}
                </p>
              </div>
              <Button variant="outline" className="w-full" disabled aria-disabled="true">
                <Navigation className="mr-2 h-4 w-4" aria-hidden="true" />
                Open Directions (Placeholder)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Related Destinations Section */}
      <section aria-labelledby="related-heading" className="border-t border-border pt-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="related-heading"
              className="text-2xl font-bold tracking-tight text-text-primary"
            >
              Related Destinations
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Other sample entries across Malappuram to test cross-destination navigation.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/destinations">All Destinations</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {relatedDestinations.map((related) => (
            <DestinationCard key={related.slug} destination={related} />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
