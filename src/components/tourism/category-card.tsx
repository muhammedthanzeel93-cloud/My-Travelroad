import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { SampleCategory } from "@/data/sample-data";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "./category-icon";

export interface CategoryCardProps {
  category: SampleCategory;
  count?: number;
}

export function CategoryCard({ category, count }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Card variant="interactive" className="h-full">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <CategoryIcon iconKey={category.iconKey} className="h-5 w-5" />
            </div>
            <ArrowUpRight
              className="h-4 w-4 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
              aria-hidden="true"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg group-hover:text-primary transition-colors">
                {category.name}
              </CardTitle>
              {typeof count === "number" && (
                <Badge variant="muted" size="sm">
                  {count} sample
                </Badge>
              )}
            </div>
            <CardDescription>{category.description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
