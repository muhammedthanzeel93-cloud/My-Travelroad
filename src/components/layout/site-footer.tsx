import Link from "next/link";
import { Compass, MapPin } from "lucide-react";
import {
  FOOTER_DISCOVERY_LINKS,
  FOOTER_CATEGORY_LINKS,
  FOOTER_PLATFORM_LINKS,
} from "./navigation";
import { PageContainer } from "./page-container";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface text-text-secondary">
      <PageContainer className="py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand Summary */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Compass className="h-5 w-5" />
              </span>
              <span className="font-heading text-base font-bold tracking-tight text-text-primary">
                My Travelroad
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-text-secondary">
              A tourism discovery and trip-planning platform starting with the landscapes, estuaries, and cultural heritage of Malappuram, Kerala.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              <MapPin className="h-3.5 w-3.5" />
              <span>Malappuram-First Discovery Scope</span>
            </div>
          </div>

          {/* Discovery Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Discovery
            </h3>
            <ul className="mt-4 space-y-2.5">
              {FOOTER_DISCOVERY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Categories
            </h3>
            <ul className="mt-4 space-y-2.5">
              {FOOTER_CATEGORY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform & Account Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Account &amp; Platform
            </h3>
            <ul className="mt-4 space-y-2.5">
              {FOOTER_PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Copyright / Phase Bar */}
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-xs text-text-secondary sm:flex-row sm:items-center">
          <p>
            My Travelroad — Structural UI Page Architecture (Task 02 Preview).
          </p>
          <p>
            Built with Next.js App Router, TypeScript, Tailwind CSS &amp; Lucide React.
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}
