import Link from "next/link";
import { Compass } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function GlobalNotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary">
      <SiteHeader />
      <main className="flex-1">
        <PageContainer spacing="relaxed">
          <EmptyState
            icon={Compass}
            title="Page Not Found (404)"
            description="The page you requested could not be found on My Travelroad. Explore Malappuram destinations or return to the home page."
            actionComponent={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild>
                  <Link href="/">Return Home</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/destinations">Browse Destinations</Link>
                </Button>
              </div>
            }
          />
        </PageContainer>
      </main>
      <SiteFooter />
    </div>
  );
}
