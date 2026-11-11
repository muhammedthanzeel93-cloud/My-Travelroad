import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Compass, SlidersHorizontal } from "lucide-react";
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
import { DestinationSortSelect } from "@/components/tourism/destination-sort-select";
import { SampleDataNotice } from "@/components/tourism/sample-data-notice";
import { SearchBarForm } from "@/components/tourism/search-bar-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "Browse Malappuram destinations with category filters, search, sorting, and pagination layout.",
};

interface DestinationsPageProps {
  searchParams: {
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
}

const PAGE_SIZE = 6;

function buildDestinationsHref(params: {
  q?: string;
  category?: string;
  sort?: string;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.category && params.category !== "all") query.set("category", params.category);
  if (params.sort && params.sort !== "popular") query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const qs = query.toString();
  return qs ? `/destinations?${qs}` : "/destinations";
}

export default function DestinationsPage({ searchParams }: DestinationsPageProps) {
  const q = searchParams.q ?? "";
  const category = searchParams.category ?? "all";
  const sort = searchParams.sort ?? "popular";
  const requestedPage = Math.max(1, Number(searchParams.page) || 1);

  const filtered = filterDestinations({ query: q, category, sort });
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <PageContainer spacing="default" className="space-y-8">
      {/* Breadcrumb & Page Heading */}
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Destinations" }]} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
              Malappuram Destinations
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary sm:text-base">
              Explore structured destination previews across Malappuram&apos;s forest reserves, coastal estuaries, hills, and cultural landmarks.
            </p>
          </div>
          <Badge variant="muted" className="self-start sm:self-auto whitespace-nowrap shrink-0">
            {totalItems} sample {totalItems === 1 ? "destination" : "destinations"}
          </Badge>
        </div>
      </div>

      <SampleDataNotice message="Listing results, sort controls, and page counts operate purely on development sample entries to validate directory UI patterns." />

      {/* Search Field + Sorting & Filtering Layout */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-subtle space-y-5">
        <SearchBarForm
          action="/destinations"
          defaultValue={q}
          category={category}
          placeholder="Filter sample destinations by name, location, or keyword..."
          buttonLabel="Filter"
        />

        <div className="flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary mr-1">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Categories:
            </span>
            <Link
              href={buildDestinationsHref({ q, category: "all", sort })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-text-secondary hover:border-primary/40 hover:text-text-primary"
              )}
            >
              All
            </Link>
            {DEV_SAMPLE_CATEGORIES.map((cat) => {
              const isActive = category === cat.slug;
              return (
                <Link
                  key={cat.slug}
                  href={buildDestinationsHref({ q, category: cat.slug, sort })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-text-secondary hover:border-primary/40 hover:text-text-primary"
                  )}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>

          {/* Sort Select */}
          <React.Suspense
            fallback={
              <div className="h-9 w-[180px] rounded-md border border-border bg-slate-50" />
            }
          >
            <DestinationSortSelect currentSort={sort} />
          </React.Suspense>
        </div>
      </div>

      {/* Destination Card Grid or Empty State */}
      {paginatedItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedItems.map((destination) => (
            <DestinationCard key={destination.slug} destination={destination} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Compass}
          title="No sample destinations match your filters"
          description="Try clearing the current search term or choosing a different Malappuram category filter."
          actionComponent={
            <Button asChild>
              <Link href="/destinations">Reset Filters</Link>
            </Button>
          }
        />
      )}

      {/* Pagination Structure */}
      <nav
        aria-label="Destination directory pagination"
        className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row"
      >
        <p className="text-sm text-text-secondary">
          Showing page <span className="font-semibold text-text-primary">{currentPage}</span> of{" "}
          <span className="font-semibold text-text-primary">{totalPages}</span>
        </p>

        <div className="flex items-center gap-2">
          {currentPage > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={buildDestinationsHref({
                  q,
                  category,
                  sort,
                  page: currentPage - 1,
                })}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
          )}

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => {
                const isCurrent = pageNumber === currentPage;
                return (
                  <Button
                    key={pageNumber}
                    variant={isCurrent ? "default" : "outline"}
                    size="sm"
                    asChild
                    className="min-w-[2.25rem]"
                  >
                    <Link
                      href={buildDestinationsHref({
                        q,
                        category,
                        sort,
                        page: pageNumber,
                      })}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      {pageNumber}
                    </Link>
                  </Button>
                );
              }
            )}
          </div>

          {currentPage < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={buildDestinationsHref({
                  q,
                  category,
                  sort,
                  page: currentPage + 1,
                })}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </nav>
    </PageContainer>
  );
}
