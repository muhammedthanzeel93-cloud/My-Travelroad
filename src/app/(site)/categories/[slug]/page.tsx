import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Compass } from "lucide-react";
import {
  DEV_SAMPLE_CATEGORIES,
  DEV_SAMPLE_DESTINATIONS,
  getCategoryBySlug,
} from "@/data/sample-data";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryIcon } from "@/components/tourism/category-icon";
import { DestinationCard } from "@/components/tourism/destination-card";
import { SampleDataNotice } from "@/components/tourism/sample-data-notice";
import { cn } from "@/lib/utils";

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return DEV_SAMPLE_CATEGORIES.map((category) => ({ slug: category.slug }));
}

export function generateMetadata({ params }: CategoryPageProps): Metadata {
  const category = getCategoryBySlug(params.slug);
  if (!category) {
    return {
      title: "Category Not Found",
    };
  }
  return {
    title: category.name,
    description: category.description,
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = getCategoryBySlug(params.slug);

  if (!category) {
    notFound();
  }

  const categoryDestinations = DEV_SAMPLE_DESTINATIONS.filter(
    (dest) => dest.categorySlug === category.slug
  );

  return (
    <PageContainer spacing="default" className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Destinations", href: "/destinations" },
          { label: category.name },
        ]}
      />

      {/* Category Heading & Description */}
      <header className="rounded-2xl border border-border bg-surface p-6 shadow-subtle sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CategoryIcon iconKey={category.iconKey} className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={category.accentVariant}>Category Preview</Badge>
                <Badge variant="muted" size="sm" className="whitespace-nowrap shrink-0">
                  {categoryDestinations.length} sample{" "}
                  {categoryDestinations.length === 1 ? "place" : "places"}
                </Badge>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
                {category.name}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
                {category.description}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" asChild className="self-start shrink-0">
            <Link href={`/destinations?category=${category.slug}`}>
              Open in Directory
            </Link>
          </Button>
        </div>

        {/* Switch Other Categories */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary mr-1">
            Switch category:
          </span>
          {DEV_SAMPLE_CATEGORIES.map((cat) => {
            const active = cat.slug === category.slug;
            return (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-text-secondary hover:border-primary/40 hover:text-text-primary"
                )}
              >
                {cat.name}
              </Link>
            );
          })}
        </div>
      </header>

      <SampleDataNotice message="This category view displays development sample destinations for Malappuram to verify structural layout and dynamic routing." />

      {/* Destination Grid */}
      {categoryDestinations.length > 0 ? (
        <section aria-labelledby="category-grid-heading" className="space-y-4">
          <h2 id="category-grid-heading" className="sr-only">
            Destinations in {category.name}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categoryDestinations.map((destination) => (
              <DestinationCard key={destination.slug} destination={destination} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Compass}
          title={`No sample entries in ${category.name}`}
          description="No development sample places are currently listed under this category."
          actionComponent={
            <Button asChild>
              <Link href="/destinations">Browse All Destinations</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
