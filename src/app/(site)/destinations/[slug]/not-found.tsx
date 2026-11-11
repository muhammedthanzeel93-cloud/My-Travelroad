import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function DestinationNotFoundPage() {
  return (
    <PageContainer spacing="relaxed" className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Destinations", href: "/destinations" },
          { label: "Not Found" },
        ]}
      />
      <EmptyState
        icon={MapPinOff}
        title="Destination Not Found"
        description="The requested destination preview could not be found in the current development sample set. Browse available sample spots in Malappuram instead."
        actionComponent={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/destinations">Browse Destinations</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        }
      />
    </PageContainer>
  );
}
