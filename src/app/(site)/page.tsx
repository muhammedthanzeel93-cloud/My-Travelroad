import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Landmark,
  MapPin,
  Mountain,
  TreePine,
  Waves,
} from "lucide-react";
import {
  DEV_SAMPLE_CATEGORIES,
  DEV_SAMPLE_DESTINATIONS,
} from "@/data/sample-data";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryCard } from "@/components/tourism/category-card";
import { DestinationCard } from "@/components/tourism/destination-card";
import { SampleDataNotice } from "@/components/tourism/sample-data-notice";
import { SearchBarForm } from "@/components/tourism/search-bar-form";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Discover Malappuram, Kerala with My Travelroad — explore forest reserves, coastal estuaries, waterfalls, and heritage sites.",
};

export default function HomePage() {
  const featuredDestinations = DEV_SAMPLE_DESTINATIONS.filter(
    (item) => item.isFeatured
  );
  const popularDestinations = DEV_SAMPLE_DESTINATIONS.filter(
    (item) => item.isPopular
  );

  return (
    <div>
      {/* 1. Hero Section & 2. Destination Search Area */}
      <section className="border-b border-border bg-surface">
        <PageContainer spacing="relaxed">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2">
                <Badge variant="subtle" dot>
                  Starting with Malappuram, Kerala
                </Badge>
                <Badge variant="muted" size="sm">
                  UI Structure Preview
                </Badge>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl lg:text-5xl text-balance">
                Discover the Landscapes &amp; Heritage of Malappuram
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
                My Travelroad brings together serene forests, river estuaries, waterfalls, and cultural landmarks into one clean, photography-focused discovery experience.
              </p>

              {/* Destination Search Area */}
              <div className="rounded-2xl border border-border bg-background p-4 shadow-subtle sm:p-5">
                <SearchBarForm action="/search" />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">Quick browse:</span>
                  {DEV_SAMPLE_CATEGORIES.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/categories/${category.slug}`}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {category.shortLabel}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button size="lg" asChild>
                  <Link href="/destinations">
                    Browse All Destinations
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/about">About the Platform</Link>
                </Button>
              </div>
            </div>

            {/* Hero Photography Frame Placeholder */}
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-border bg-slate-50 shadow-card">
                <div className="flex aspect-[4/3] flex-col items-center justify-center bg-primary/10 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-primary shadow-subtle">
                    <Compass className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-text-primary">
                    Malappuram Hero Photography Frame
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-text-secondary">
                    Clean editorial showcase area reserved for verified landscape photography.
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-3.5 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 font-medium text-text-primary">
                    <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Malappuram District, Kerala
                  </span>
                  <span>Preview Frame</span>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Development Notice */}
      <PageContainer className="pt-8">
        <SampleDataNotice message="The destinations and categories below use development sample entries strictly to validate Task 02 page layouts and navigation." />
      </PageContainer>

      {/* 3. Destination Categories */}
      <section aria-labelledby="home-categories-heading">
        <PageContainer spacing="default">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="home-categories-heading"
                className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
              >
                Explore by Category
              </h2>
              <p className="mt-1 text-sm text-text-secondary sm:text-base">
                Browse Malappuram&apos;s varied terrain through structured thematic collections.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild className="self-start sm:self-auto text-primary">
              <Link href="/destinations">
                View directory <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DEV_SAMPLE_CATEGORIES.map((category) => {
              const count = DEV_SAMPLE_DESTINATIONS.filter(
                (dest) => dest.categorySlug === category.slug
              ).length;
              return (
                <CategoryCard
                  key={category.slug}
                  category={category}
                  count={count}
                />
              );
            })}
          </div>
        </PageContainer>
      </section>

      {/* 4. Featured Destinations Section */}
      <section aria-labelledby="home-featured-heading" className="border-y border-border bg-surface">
        <PageContainer spacing="default">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge variant="accentSubtle" size="sm" className="mb-2">
                Curated Preview
              </Badge>
              <h2
                id="home-featured-heading"
                className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
              >
                Featured Destinations
              </h2>
              <p className="mt-1 text-sm text-text-secondary sm:text-base">
                Sample spotlight layouts representing distinct Malappuram landscapes.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="self-start sm:self-auto">
              <Link href="/destinations?sort=featured">See Featured</Link>
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredDestinations.map((destination) => (
              <DestinationCard key={destination.slug} destination={destination} />
            ))}
          </div>
        </PageContainer>
      </section>

      {/* 5. Popular Destinations Section */}
      <section aria-labelledby="home-popular-heading">
        <PageContainer spacing="default">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="home-popular-heading"
                className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
              >
                Popular Destinations
              </h2>
              <p className="mt-1 text-sm text-text-secondary sm:text-base">
                Sample destinations arranged to preview responsive listing grids.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild className="self-start sm:self-auto text-primary">
              <Link href="/destinations">
                Explore all sample places <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {popularDestinations.map((destination) => (
              <DestinationCard key={destination.slug} destination={destination} />
            ))}
          </div>
        </PageContainer>
      </section>

      {/* 6. Malappuram Discovery Section */}
      <section aria-labelledby="home-malappuram-heading" className="border-t border-border bg-surface">
        <PageContainer spacing="relaxed">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            <div className="space-y-4 lg:col-span-5">
              <Badge variant="secondarySubtle">Regional Discovery Focus</Badge>
              <h2
                id="home-malappuram-heading"
                className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
              >
                Why Start with Malappuram?
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
                Stretching from the forested eastern valleys bordering the Western Ghats to the coastal estuaries meeting the Arabian Sea, Malappuram brings together diverse ecosystems within short travel corridors.
              </p>
              <div className="pt-2">
                <Button variant="secondary" asChild>
                  <Link href="/about">
                    Read Our Malappuram-First Vision
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
              <Card variant="muted">
                <CardHeader className="space-y-2">
                  <TreePine className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base">Eastern Forest Valleys</CardTitle>
                  <CardDescription>
                    Woodland reserves, river streams, and shaded trails structured for eco-conscious discovery.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card variant="muted">
                <CardHeader className="space-y-2">
                  <Waves className="h-5 w-5 text-secondary" aria-hidden="true" />
                  <CardTitle className="text-base">Estuaries &amp; Coastline</CardTitle>
                  <CardDescription>
                    River mouths, mangroves, and serene coastal walks highlighted across western taluks.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card variant="muted">
                <CardHeader className="space-y-2">
                  <Mountain className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base">Highland Viewpoints</CardTitle>
                  <CardDescription>
                    Elevated ridge lookouts and seasonal waterfalls organized for clear access planning.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card variant="muted">
                <CardHeader className="space-y-2">
                  <Landmark className="h-5 w-5 text-amber-700" aria-hidden="true" />
                  <CardTitle className="text-base">Living Cultural Heritage</CardTitle>
                  <CardDescription>
                    Traditional wellness centers, riverfront grounds, and historical community precincts.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
