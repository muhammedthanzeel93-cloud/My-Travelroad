import * as React from "react";
import Link from "next/link";
import { ArrowRight, Camera, MapPin } from "lucide-react";
import {
  getCategoryBySlug,
  type CategoryIconKey,
  type SampleDestination,
} from "@/data/sample-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "./category-icon";
import { cn } from "@/lib/utils";

const frameBgByIcon: Record<CategoryIconKey, string> = {
  forest: "bg-primary-900/10 text-primary",
  coast: "bg-secondary-900/10 text-secondary",
  hills: "bg-emerald-950/10 text-primary",
  heritage: "bg-amber-500/10 text-amber-800",
};

export interface DestinationCardProps {
  destination: SampleDestination;
  actionSlot?: React.ReactNode;
}

export function DestinationCard({ destination, actionSlot }: DestinationCardProps) {
  const category = getCategoryBySlug(destination.categorySlug);

  return (
    <Card variant="interactive" className="flex h-full flex-col overflow-hidden group">
      {/* Photography Placeholder Frame */}
      <Link
        href={`/destinations/${destination.slug}`}
        className={cn(
          "relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden border-b border-border",
          frameBgByIcon[destination.iconKey]
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface/90 shadow-subtle transition-transform duration-200 group-hover:scale-105">
            <CategoryIcon iconKey={destination.iconKey} className="h-6 w-6" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-0.5 text-[11px] font-medium text-text-secondary shadow-subtle">
            <Camera className="h-3 w-3" aria-hidden="true" />
            Photo Frame Placeholder
          </span>
        </div>

        {/* Category Overlay Pill */}
        {category && (
          <div className="absolute left-3 top-3">
            <Badge variant={category.accentVariant} className="bg-surface/95 backdrop-blur-sm">
              {category.shortLabel}
            </Badge>
          </div>
        )}

        {destination.isFeatured && (
          <div className="absolute right-3 top-3">
            <Badge variant="accent" size="sm">
              Featured Sample
            </Badge>
          </div>
        )}
      </Link>

      <CardHeader className="pb-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="truncate">{destination.location}</span>
        </div>
        <CardTitle className="mt-1 text-lg leading-snug">
          <Link
            href={`/destinations/${destination.slug}`}
            className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline"
          >
            {destination.title}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        <CardDescription className="line-clamp-3">
          {destination.shortDescription}
        </CardDescription>
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 bg-slate-50/50 px-6 py-3.5">
        {actionSlot ? (
          actionSlot
        ) : (
          <span className="text-xs font-medium text-text-secondary">
            {destination.region}
          </span>
        )}
        <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary-hover">
          <Link href={`/destinations/${destination.slug}`}>
            Explore <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
