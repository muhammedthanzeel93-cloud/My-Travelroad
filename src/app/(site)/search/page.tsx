import type { Metadata } from "next";
import Link from "next/link";
import { Filter, Search, SearchX } from "lucide-react";
import {
  DEV_SAMPLE_CATEGORIES,
  filterDestinations,
} from "@/data/sample-data";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DestinationCard } from "@/components/tourism/destination-card";
import { SampleDataNotice } from "@/components/tourism/sample-data-notice";
import { SearchBarForm } from "@/components/tourism/search-bar-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Search Destinations",
  description:
    "Search Malappuram tourism sample destinations, categories, and filters on My Travelroad.",
};

interface SearchPageProps {
  searchParams: {
    q?: string;
    category?: string;
  };
}

function buildSearchHref(q: string, category: string) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (category && category !== "all") params.set("category", category);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const q = searchParams.q ?? "";
  const category = searchParams.category ?? "all";
  const hasQuery = q.trim().length > 0;

  const results = filterDestinations({
    query: q,
    category,
    sort: "popular",
  });

  return (
    <PageContainer spacing="default" className="space-y-8">
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Search" }]} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
              Search Results
            </h1>
            <p className="mt-2 text-sm text-text-secondary sm:text-base">
              {hasQuery ? (
                <>
                  Showing sample matches for{" "}
                  <span className="font-semibold text-text-primary">
                    &ldquo;{q.trim()}&rdquo;
                  </span>
                </>
              ) : (
                "Enter a keyword or choose a category filter to inspect search layout states."
              )}
            </p>
          </div>
          <Badge variant="muted" className="self-start sm:self-auto whitespace-nowrap shrink-0">
            {results.length} {results.length === 1 ? "result" : "results"}
          </Badge>
        </div>
      </div>

      <SampleDataNotice message="Search filtering matches against development-only Malappuram sample records; backend search indexing is excluded from Task 02." />

      {/* Search Bar & Filter Structure */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-subtle space-y-5">
        <SearchBarForm
          action="/search"
          defaultValue={q}
          category={category}
          placeholder="Try searching Nilambur, Kadalundi, Coast, Heritage..."
        />

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary mr-1">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Filter:
            </span>
            <Link
              href={buildSearchHref(q, "all")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-text-secondary hover:border-primary/40 hover:text-text-primary"
              )}
            >
              All Categories
            </Link>
            {DEV_SAMPLE_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={buildSearchHref(q, cat.slug)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === cat.slug
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-text-secondary hover:border-primary/40 hover:text-text-primary"
                )}
              >
                {cat.shortLabel}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/search?q=no-matching-place"
              className="text-secondary font-medium hover:underline"
            >
              Preview Empty State
            </Link>
            {(hasQuery || category !== "all") && (
              <>
                <span className="text-border">•</span>
                <Link
                  href="/search"
                  className="text-text-secondary hover:text-text-primary hover:underline"
                >
                  Clear Query
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Results Layout vs Empty Results State */}
      {results.length > 0 ? (
        <section aria-labelledby="search-results-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="search-results-heading"
              className="flex items-center gap-2 text-lg font-semibold text-text-primary"
            >
              <Search className="h-4 w-4 text-primary" aria-hidden="true" />
              {hasQuery ? "Matching Sample Destinations" : "All Preview Destinations"}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((destination) => (
              <DestinationCard key={destination.slug} destination={destination} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={SearchX}
          title={
            hasQuery
              ? `No results found for "${q.trim()}"`
              : "No matching destinations found"
          }
          description="No development sample destinations matched your current search query and category filter. Try another Malappuram keyword such as Nilambur, Kadalundi, or Heritage."
          actionComponent={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/search">Clear Search</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/destinations">Browse All Destinations</Link>
              </Button>
            </div>
          }
        />
      )}
    </PageContainer>
  );
}
