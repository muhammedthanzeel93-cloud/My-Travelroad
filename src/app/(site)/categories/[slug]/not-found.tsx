import Link from "next/link";
import { FolderSearch } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function CategoryNotFoundPage() {
  return (
    <PageContainer spacing="relaxed" className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Destinations", href: "/destinations" },
          { label: "Category Not Found" },
        ]}
      />
      <EmptyState
        icon={FolderSearch}
        title="Category Not Found"
        description="The requested destination category does not exist in the Task 02 development preview."
        actionComponent={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/categories/nature-forests">Nature &amp; Forests</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/destinations">Browse All Destinations</Link>
            </Button>
          </div>
        }
      />
    </PageContainer>
  );
}
