import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Eye,
  Landmark,
  MapPin,
  Target,
  TreePine,
  Waves,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about My Travelroad's platform mission, vision, and Malappuram-first tourism discovery concept.",
};

export default function AboutPage() {
  return (
    <PageContainer spacing="default" className="space-y-12">
      {/* Breadcrumbs & Platform Introduction */}
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "About" }]} />

        <section
          aria-labelledby="about-intro-heading"
          className="rounded-2xl border border-border bg-surface p-6 shadow-subtle sm:p-10"
        >
          <div className="max-w-3xl space-y-4">
            <Badge variant="subtle" dot>
              Platform Overview
            </Badge>
            <h1
              id="about-intro-heading"
              className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl lg:text-5xl"
            >
              About My Travelroad
            </h1>
            <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
              My Travelroad is a modern tourism discovery and trip-planning platform designed to make regional exploration clearer, calmer, and better organized—beginning with Malappuram district in Kerala, India.
            </p>
            <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
              Instead of overwhelming travelers with fragmented information, the platform establishes a clean, photography-focused interface that highlights nature reserves, coastlines, hills, and cultural heritage in a structured way.
            </p>
          </div>
        </section>
      </div>

      {/* Mission and Vision Sections */}
      <section aria-labelledby="mission-vision-heading" className="space-y-6">
        <h2
          id="mission-vision-heading"
          className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
        >
          Mission &amp; Vision
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Target className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl">Our Mission</CardTitle>
              <CardDescription>
                Structured, trustworthy local discovery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
                To organize regional destinations with transparent visitor context, clean visual hierarchies, and practical categorization so travelers can explore local landscapes thoughtfully and responsibly.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <Eye className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl">Our Vision</CardTitle>
              <CardDescription>
                Sustainable district-by-district expansion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
                To grow from a deeply curated Malappuram foundation into a broader Kerala discovery companion that elevates lesser-known ecological treasures alongside established heritage landmarks.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Malappuram-First Tourism Concept */}
      <section
        aria-labelledby="malappuram-concept-heading"
        className="rounded-2xl border border-border bg-surface p-6 shadow-subtle sm:p-10 space-y-8"
      >
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>Regional Strategy</span>
          </div>
          <h2
            id="malappuram-concept-heading"
            className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
          >
            The Malappuram-First Tourism Concept
          </h2>
          <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
            Focusing first on Malappuram allows us to model real geographic diversity before scaling outward. Within a single district, travelers transition from forested eastern valleys to river estuaries and historic cultural towns.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Card variant="muted">
            <CardHeader className="space-y-2">
              <TreePine className="h-5 w-5 text-primary" aria-hidden="true" />
              <CardTitle className="text-base">Ecological Depth</CardTitle>
              <CardDescription>
                Eastern corridors around Nilambur offer shaded forestry environments and hillside cascades suited for slow, nature-first itineraries.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card variant="muted">
            <CardHeader className="space-y-2">
              <Waves className="h-5 w-5 text-secondary" aria-hidden="true" />
              <CardTitle className="text-base">Coastal &amp; River Confluences</CardTitle>
              <CardDescription>
                Western estuaries and beaches connect inland river systems to the Arabian Sea, supporting calm coastal viewpoints and bird habitats.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card variant="muted">
            <CardHeader className="space-y-2">
              <Landmark className="h-5 w-5 text-amber-700" aria-hidden="true" />
              <CardTitle className="text-base">Cultural Continuity</CardTitle>
              <CardDescription>
                Historic centers of wellness, riverfront traditions, and regional crafts bring lived heritage into everyday travel discovery.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <Button asChild>
            <Link href="/destinations">
              <Compass className="mr-2 h-4 w-4" aria-hidden="true" />
              Explore Sample Destinations
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              Return Home
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}
