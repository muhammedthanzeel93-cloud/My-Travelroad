"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Compass,
  MapPin,
  Calendar,
  Clock,
  Star,
  Search,
  Filter,
  Check,
  TreePine,
  Waves,
  Mountain,
  Sun,
  Camera,
  Heart,
  Share2,
  Bookmark,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Phone,
  Mail,
  User,
  Users,
  Eye,
  SlidersHorizontal,
  Navigation,
  Footprints,
  Coffee,
  Bed,
  Car,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  HelpCircle,
  Palmtree,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton, DestinationCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

export default function DesignSystemShowcasePage() {
  const [isButtonLoading, setIsButtonLoading] = React.useState(false);
  const [showSkeletonDemo, setShowSkeletonDemo] = React.useState(false);
  const [switchChecked, setSwitchChecked] = React.useState(true);
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background text-text-primary pb-24">
      {/* Top Navigation Banner */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Compass className="h-6 w-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-lg font-bold tracking-tight text-text-primary">
                  My Travelroad
                </span>
                <Badge variant="subtle" size="sm">Design System</Badge>
              </div>
              <p className="text-xs text-text-secondary">
                Tourism UI Foundation • Malappuram, Kerala
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondarySubtle" className="hidden sm:inline-flex">
              <Sparkles className="mr-1 h-3 w-3" /> Nature-Inspired
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.success("Design Tokens active: Primary #166534, Secondary #0F766E, Accent #F59E0B");
              }}
            >
              Verify System
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Introduction */}
      <section className="border-b border-border bg-surface py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <TreePine className="h-4 w-4" />
              <span>Design System Specification</span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
              User-Facing UI Design Foundation
            </h1>
            <p className="mt-4 text-base sm:text-lg text-text-secondary leading-relaxed">
              A bespoke, accessible design system tailored for modern tourism discovery and trip-planning in Malappuram, Kerala. Crafted with deep forest greens, river teals, and spice ambers with strict typographic and component consistency.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <span className="text-xs font-medium text-text-secondary">Primary Green</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-primary" />
                <span className="font-mono text-sm font-semibold text-text-primary">#166534</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <span className="text-xs font-medium text-text-secondary">Secondary Teal</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-secondary" />
                <span className="font-mono text-sm font-semibold text-text-primary">#0F766E</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <span className="text-xs font-medium text-text-secondary">Accent Amber</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-accent" />
                <span className="font-mono text-sm font-semibold text-text-primary">#F59E0B</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <span className="text-xs font-medium text-text-secondary">Typography</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary">Inter</span>
                <span className="text-xs text-text-secondary">(Google Font)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16">

        {/* SECTION 1: COLOR PALETTE TOKENS */}
        <section id="colors" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              1. Color Palette Tokens
            </h2>
            <p className="text-sm text-text-secondary">
              Theme tokens reflecting the natural heritage of Malappuram — lush teak forests, Chaliyar river, and spice warmth.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {/* Primary */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-primary p-3 flex items-end justify-between text-white font-mono text-xs">
                <span>Primary</span>
                <span>#166534</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Forest Green</h4>
                <p className="text-xs text-text-secondary mt-0.5">Teak reserves & hills</p>
              </div>
            </div>

            {/* Primary Hover */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-[#14532D] p-3 flex items-end justify-between text-white font-mono text-xs">
                <span>Primary Hover</span>
                <span>#14532D</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Deep Forest</h4>
                <p className="text-xs text-text-secondary mt-0.5">Active & hover interaction</p>
              </div>
            </div>

            {/* Secondary */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-secondary p-3 flex items-end justify-between text-white font-mono text-xs">
                <span>Secondary</span>
                <span>#0F766E</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Deep Teal</h4>
                <p className="text-xs text-text-secondary mt-0.5">Rivers, estuaries & coast</p>
              </div>
            </div>

            {/* Accent */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-accent p-3 flex items-end justify-between text-slate-900 font-mono text-xs font-semibold">
                <span>Accent</span>
                <span>#F59E0B</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Sunlit Amber</h4>
                <p className="text-xs text-text-secondary mt-0.5">Ratings, highlights, culture</p>
              </div>
            </div>

            {/* Background */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-[#F8FAFC] border-b border-border p-3 flex items-end justify-between text-text-primary font-mono text-xs">
                <span>Background</span>
                <span>#F8FAFC</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Canvas Slate</h4>
                <p className="text-xs text-text-secondary mt-0.5">Clean photo canvas</p>
              </div>
            </div>

            {/* Surface */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-surface border-b border-border p-3 flex items-end justify-between text-text-primary font-mono text-xs">
                <span>Surface</span>
                <span>#FFFFFF</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Crisp White</h4>
                <p className="text-xs text-text-secondary mt-0.5">Card & modal surfaces</p>
              </div>
            </div>

            {/* Primary Text */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-[#172033] p-3 flex items-end justify-between text-white font-mono text-xs">
                <span>Primary Text</span>
                <span>#172033</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Slate 900</h4>
                <p className="text-xs text-text-secondary mt-0.5">High-contrast readable headers</p>
              </div>
            </div>

            {/* Secondary Text */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-[#64748B] p-3 flex items-end justify-between text-white font-mono text-xs">
                <span>Secondary Text</span>
                <span>#64748B</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Slate 500</h4>
                <p className="text-xs text-text-secondary mt-0.5">Metadata & subheaders</p>
              </div>
            </div>

            {/* Border */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
              <div className="h-24 bg-[#E2E8F0] p-3 flex items-end justify-between text-text-primary font-mono text-xs">
                <span>Border</span>
                <span>#E2E8F0</span>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-text-primary">Slate 200</h4>
                <p className="text-xs text-text-secondary mt-0.5">Dividers & perimeter lines</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: TYPOGRAPHY HIERARCHY */}
        <section id="typography" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              2. Typography System (Inter)
            </h2>
            <p className="text-sm text-text-secondary">
              Consistent hierarchy from large hero display headlines down to compact metadata and caption tags.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-border/60 pb-4">
              <span className="text-xs font-mono text-text-secondary">Display H1 (40px/48px)</span>
              <h1 className="md:col-span-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-text-primary">
                Nilambur Teak Heritage
              </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-border/60 pb-4">
              <span className="text-xs font-mono text-text-secondary">Heading H2 (30px/36px)</span>
              <h2 className="md:col-span-3 text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                Kottakkal Ayurvedic Sanctuary
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-border/60 pb-4">
              <span className="text-xs font-mono text-text-secondary">Heading H3 (24px/32px)</span>
              <h3 className="md:col-span-3 text-xl sm:text-2xl font-semibold text-text-primary">
                Kadalundi Estuary & Migratory Birds
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-border/60 pb-4">
              <span className="text-xs font-mono text-text-secondary">Heading H4 (18px/28px)</span>
              <h4 className="md:col-span-3 text-lg font-semibold text-text-primary">
                Padinharekara Beach Sunset Point
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-border/60 pb-4">
              <span className="text-xs font-mono text-text-secondary">Body Large (18px)</span>
              <p className="md:col-span-3 text-lg text-text-secondary leading-relaxed">
                Experience the calm backwaters where the Bharathapuzha and Tirur rivers meet the Arabian Sea, offering panoramic sunset horizons.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-border/60 pb-4">
              <span className="text-xs font-mono text-text-secondary">Body Default (16px)</span>
              <p className="md:col-span-3 text-base text-text-primary leading-normal">
                Malappuram district unfolds lush spice hills, ancient temple architectural treasures, and traditional eco-tourism walks curated by registered local guides.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline">
              <span className="text-xs font-mono text-text-secondary">Caption / Microcopy (12px)</span>
              <span className="md:col-span-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Altitude: 450m • Best Season: Oct – Mar • Entry Fee: ₹40
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 3: BUTTONS & INTERACTION STATES */}
        <section id="buttons" className="space-y-6">
          <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                3. Button Variants & Sizes
              </h2>
              <p className="text-sm text-text-secondary">
                Seven distinct semantic variants with loading states, sizes, and Lucide React icon integrations.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsButtonLoading(!isButtonLoading)}
            >
              Toggle Loading State
            </Button>
          </div>

          {/* Variants */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block mb-3">
                Variants Matrix
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default" isLoading={isButtonLoading}>
                  <Compass className="mr-2 h-4 w-4" /> Primary Button
                </Button>
                <Button variant="secondary" isLoading={isButtonLoading}>
                  <Waves className="mr-2 h-4 w-4" /> Secondary Teal
                </Button>
                <Button variant="accent" isLoading={isButtonLoading}>
                  <Sparkles className="mr-2 h-4 w-4" /> Accent Amber
                </Button>
                <Button variant="outline" isLoading={isButtonLoading}>
                  <Filter className="mr-2 h-4 w-4" /> Outline
                </Button>
                <Button variant="ghost" isLoading={isButtonLoading}>
                  <Bookmark className="mr-2 h-4 w-4" /> Ghost
                </Button>
                <Button variant="link">
                  Learn more <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
                <Button variant="destructive" isLoading={isButtonLoading}>
                  <AlertCircle className="mr-2 h-4 w-4" /> Destructive
                </Button>
              </div>
            </div>

            {/* Sizes */}
            <div className="border-t border-border pt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block mb-3">
                Sizes Matrix
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small (h-8)</Button>
                <Button size="default">Default (h-10)</Button>
                <Button size="lg">
                  Large (h-12) <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="icon" variant="outline" aria-label="Search">
                  <Search className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="default" aria-label="Favorites">
                  <Heart className="h-4 w-4" />
                </Button>
                <Button size="icon-sm" variant="secondary" aria-label="Share">
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: FORM CONTROLS */}
        <section id="form-controls" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              4. Form Elements & Input Controls
            </h2>
            <p className="text-sm text-text-secondary">
              Accessible inputs, icon prefixes, validation states, textareas, selects, checkboxes, radios, and toggle switches.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Input with start icon */}
              <div className="space-y-2">
                <Label htmlFor="destination-search">Search Destinations</Label>
                <Input
                  id="destination-search"
                  placeholder="e.g. Nilambur, Kottakkal, Kadalundi..."
                  startIcon={<Search className="h-4 w-4" />}
                />
                <p className="text-xs text-text-secondary">
                  Search across 50+ eco-tourism spots in Malappuram.
                </p>
              </div>

              {/* Input with Location pin */}
              <div className="space-y-2">
                <Label htmlFor="starting-point">Starting Point</Label>
                <Input
                  id="starting-point"
                  placeholder="e.g. Manjeri, Tirur, Calicut Airport"
                  startIcon={<MapPin className="h-4 w-4 text-primary" />}
                />
              </div>

              {/* Input with Error State */}
              <div className="space-y-2">
                <Label htmlFor="date-input" className="text-destructive">
                  Travel Date (Validation Error Demo)
                </Label>
                <Input
                  id="date-input"
                  type="date"
                  error
                  defaultValue="2020-01-01"
                  startIcon={<Calendar className="h-4 w-4 text-destructive" />}
                />
                <p className="text-xs font-medium text-destructive">
                  Please select a future travel date for itinerary planning.
                </p>
              </div>

              {/* Select Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="destination-type">Destination Category</Label>
                <Select defaultValue="nature">
                  <SelectTrigger id="destination-type">
                    <SelectValue placeholder="Select tourism category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Malappuram Highlights</SelectLabel>
                      <SelectItem value="nature">Nature & Teak Forests</SelectItem>
                      <SelectItem value="heritage">Ayurvedic & Cultural Heritage</SelectItem>
                      <SelectItem value="water">Estuaries & Beaches</SelectItem>
                      <SelectItem value="hill">Hilltops & Viewpoints</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Textarea */}
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="travel-notes">Trip Customization Notes</Label>
                <Textarea
                  id="travel-notes"
                  placeholder="Mention special requirements: trekking permits, dietary preferences, senior citizen accessibility..."
                  rows={3}
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <Label className="block">Tour Preferences</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="pref-guide" defaultChecked />
                    <label
                      htmlFor="pref-guide"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-text-primary"
                    >
                      Certified local guide included
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="pref-photo" defaultChecked />
                    <label
                      htmlFor="pref-photo"
                      className="text-sm font-medium leading-none text-text-primary"
                    >
                      Photography permit included
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="pref-eco" />
                    <label
                      htmlFor="pref-eco"
                      className="text-sm font-medium leading-none text-text-primary"
                    >
                      Zero-waste eco-tour certified
                    </label>
                  </div>
                </div>
              </div>

              {/* Radio Group & Switch */}
              <div className="space-y-4">
                <div>
                  <Label className="block mb-2">Trip Duration</Label>
                  <RadioGroup defaultValue="full-day">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="half-day" id="dur-half" />
                      <Label htmlFor="dur-half" className="font-normal">
                        Half Day (4 hours)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="full-day" id="dur-full" />
                      <Label htmlFor="dur-full" className="font-normal">
                        Full Day (8 hours - Most Popular)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="multi-day" id="dur-multi" />
                      <Label htmlFor="dur-multi" className="font-normal">
                        Weekend Circuit (2 Days)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <div>
                    <Label htmlFor="instant-booking" className="block text-sm font-medium">
                      Instant Booking Confirmation
                    </Label>
                    <p className="text-xs text-text-secondary">
                      Reserve immediately without waiting for host confirmation.
                    </p>
                  </div>
                  <Switch
                    id="instant-booking"
                    checked={switchChecked}
                    onCheckedChange={setSwitchChecked}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: CARD VARIANTS & TOURISM DESTINATIONS */}
        <section id="cards" className="space-y-6">
          <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                5. Tourism Destination Cards & Variants
              </h2>
              <p className="text-sm text-text-secondary">
                Clean, photography-focused card components optimized for Kerala tourism discovery.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSkeletonDemo(!showSkeletonDemo)}
            >
              {showSkeletonDemo ? "Show Destination Cards" : "Preview Loading Skeleton"}
            </Button>
          </div>

          {showSkeletonDemo ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DestinationCardSkeleton />
              <DestinationCardSkeleton />
              <DestinationCardSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Nilambur Teak Forest */}
              <Card variant="interactive" className="overflow-hidden flex flex-col group">
                <div className="relative h-48 w-full bg-slate-800 overflow-hidden">
                  {/* Clean SVG Placeholder Pattern */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-900 flex items-center justify-center">
                    <TreePine className="h-16 w-16 text-emerald-400/30 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <Badge variant="default">
                      <TreePine className="mr-1 h-3 w-3" /> Eco Sanctuary
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-text-primary shadow-sm hover:text-red-500 transition-colors"
                      aria-label="Save to favorites"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success("Saved Nilambur Teak Reserve to your travel road!");
                      }}
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium">
                    <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">
                      <MapPin className="h-3 w-3 text-emerald-400" /> Nilambur, Malappuram
                    </span>
                    <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md text-amber-300">
                      <Star className="h-3 w-3 fill-amber-300" /> 4.9 (1,240)
                    </span>
                  </div>
                </div>
                <CardHeader>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    Nilambur Teak Forest & Museum
                  </CardTitle>
                  <CardDescription>
                    Home to the world&apos;s oldest teak plantation (Conolly&apos;s Plot) along the serene Chaliyar river basin with hanging bridges.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto pt-0 flex items-center justify-between border-t border-border/50 p-4">
                  <div>
                    <span className="text-xs text-text-secondary block">Entry ticket</span>
                    <span className="text-base font-bold text-text-primary">₹50 / person</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsDialogOpen(true);
                    }}
                  >
                    View Details
                  </Button>
                </CardFooter>
              </Card>

              {/* Card 2: Kadalundi Bird Sanctuary */}
              <Card variant="interactive" className="overflow-hidden flex flex-col group">
                <div className="relative h-48 w-full bg-slate-800 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-950 via-teal-800 to-sky-900 flex items-center justify-center">
                    <Waves className="h-16 w-16 text-teal-400/30 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <Badge variant="secondary">
                      <Waves className="mr-1 h-3 w-3" /> Estuary & Birds
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-text-primary shadow-sm hover:text-red-500 transition-colors"
                      aria-label="Save to favorites"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success("Saved Kadalundi Estuary to your travel road!");
                      }}
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium">
                    <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">
                      <MapPin className="h-3 w-3 text-teal-400" /> Kadalundi Vallikkunnu
                    </span>
                    <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md text-amber-300">
                      <Star className="h-3 w-3 fill-amber-300" /> 4.8 (890)
                    </span>
                  </div>
                </div>
                <CardHeader>
                  <CardTitle className="text-lg group-hover:text-secondary transition-colors">
                    Kadalundi Bird Sanctuary
                  </CardTitle>
                  <CardDescription>
                    Where the river meets the Arabian sea, creating island wetlands hosting over a hundred migratory bird species.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto pt-0 flex items-center justify-between border-t border-border/50 p-4">
                  <div>
                    <span className="text-xs text-text-secondary block">Boating fee</span>
                    <span className="text-base font-bold text-text-primary">₹250 / boat</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setIsDialogOpen(true);
                    }}
                  >
                    View Details
                  </Button>
                </CardFooter>
              </Card>

              {/* Card 3: Kottakkal Arya Vaidya Sala */}
              <Card variant="interactive" className="overflow-hidden flex flex-col group">
                <div className="relative h-48 w-full bg-slate-800 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-amber-800 to-yellow-900 flex items-center justify-center">
                    <Sparkles className="h-16 w-16 text-amber-400/30 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <Badge variant="accent">
                      <Sparkles className="mr-1 h-3 w-3" /> Ayurvedic Heritage
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-text-primary shadow-sm hover:text-red-500 transition-colors"
                      aria-label="Save to favorites"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success("Saved Kottakkal Heritage to your travel road!");
                      }}
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium">
                    <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">
                      <MapPin className="h-3 w-3 text-amber-400" /> Kottakkal, Malappuram
                    </span>
                    <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md text-amber-300">
                      <Star className="h-3 w-3 fill-amber-300" /> 4.9 (2,100)
                    </span>
                  </div>
                </div>
                <CardHeader>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    Kottakkal Arya Vaidya Sala
                  </CardTitle>
                  <CardDescription>
                    Pioneering center of authentic classical Ayurvedic medicine, museum, and medicinal botanical gardens since 1902.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto pt-0 flex items-center justify-between border-t border-border/50 p-4">
                  <div>
                    <span className="text-xs text-text-secondary block">Herb Garden Tour</span>
                    <span className="text-base font-bold text-text-primary">Free Entry</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(true);
                    }}
                  >
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* Highlight & Muted Card Variants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <Card variant="highlight">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="subtle">Featured Circuit</Badge>
                  <span className="text-xs text-primary font-semibold flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" /> Official Tourism Route
                  </span>
                </div>
                <CardTitle className="mt-2 text-xl">
                  Malappuram Eco & Heritage 3-Day Expedition
                </CardTitle>
                <CardDescription>
                  Curated itinerary connecting Nilambur Teak Plantations, Adyanpara Waterfalls, Kottakkal Ayurvedic gardens, and Padinharekara beach sunsets.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-between items-center">
                <span className="text-sm font-semibold text-text-primary">3 Days • 2 Nights</span>
                <Button size="sm">Explore Itinerary</Button>
              </CardFooter>
            </Card>

            <Card variant="muted">
              <CardHeader>
                <CardTitle className="text-base">Traveler Guidelines & Permitting</CardTitle>
                <CardDescription>
                  Plastic-free zone rules apply across Nilambur teak reserves and Kadalundi wetlands. Forest Department check-posts issue day-trekking passes between 08:00 AM and 04:00 PM.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary-hover p-0">
                  Read tourism code of conduct <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* SECTION 6: BADGES & AVATARS */}
        <section id="badges-avatars" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              6. Badges, Status Dots & Guide Avatars
            </h2>
            <p className="text-sm text-text-secondary">
              Status tags, categories, and traveler/guide avatars with active presence indicators.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Badges Box */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                Badge Variants & Indicators
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" dot>Primary Forest</Badge>
                <Badge variant="secondary" dot>Secondary Teal</Badge>
                <Badge variant="accent" dot>Accent Amber</Badge>
                <Badge variant="subtle">Subtle Forest</Badge>
                <Badge variant="secondarySubtle">Subtle Teal</Badge>
                <Badge variant="accentSubtle">Subtle Amber</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="muted">Neutral Tag</Badge>
                <Badge variant="destructive" dot>Monsoon Warning</Badge>
              </div>

              <div className="pt-2 border-t border-border">
                <span className="text-xs text-text-secondary block mb-2">Sizes</span>
                <div className="flex items-center gap-2">
                  <Badge size="sm">Small Tag</Badge>
                  <Badge size="default">Default Tag</Badge>
                  <Badge size="lg">Large Tourism Badge</Badge>
                </div>
              </div>
            </div>

            {/* Avatars Box */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                Certified Guides & Travelers
              </h3>
              
              <div className="flex items-center gap-4">
                <Avatar size="sm" status="online">
                  <AvatarFallback>AK</AvatarFallback>
                </Avatar>
                <Avatar size="default" status="online">
                  <AvatarFallback>MR</AvatarFallback>
                </Avatar>
                <Avatar size="lg" status="busy">
                  <AvatarFallback>FS</AvatarFallback>
                </Avatar>
                <Avatar size="xl" status="online">
                  <AvatarFallback>KL</AvatarFallback>
                </Avatar>
              </div>

              <div className="pt-2 border-t border-border">
                <span className="text-xs text-text-secondary block mb-2">
                  Guide Stack (Tour group leaders in Nilambur)
                </span>
                <div className="flex items-center justify-between">
                  <AvatarGroup>
                    <Avatar>
                      <AvatarFallback>NB</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback>KT</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback>AM</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback>PK</AvatarFallback>
                    </Avatar>
                  </AvatarGroup>
                  <span className="text-xs text-text-secondary">
                    +18 registered Malappuram guides available today
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: TABS & NAVIGATION */}
        <section id="tabs" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              7. Tabbed Navigation
            </h2>
            <p className="text-sm text-text-secondary">
              Accessible tabs for category switching, itinerary planning, and transport information.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <Tabs defaultValue="all" onValueChange={setSelectedCategory}>
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
                <TabsTrigger value="all">
                  <Compass className="mr-1.5 h-3.5 w-3.5" /> All Highlights
                </TabsTrigger>
                <TabsTrigger value="forests">
                  <TreePine className="mr-1.5 h-3.5 w-3.5" /> Teak Reserves
                </TabsTrigger>
                <TabsTrigger value="coastal">
                  <Waves className="mr-1.5 h-3.5 w-3.5" /> Estuary & Coast
                </TabsTrigger>
                <TabsTrigger value="heritage">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ayurveda & Culture
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="pt-4">
                <div className="rounded-lg border border-border/80 bg-background p-4 text-sm text-text-secondary">
                  Displaying complete Malappuram tourism catalog: 48 registered locations including waterfalls (Adyanpara, Keralamkundu), heritage shrines, and river viewpoints.
                </div>
              </TabsContent>
              <TabsContent value="forests" className="pt-4">
                <div className="rounded-lg border border-border/80 bg-background p-4 text-sm text-text-secondary">
                  Focusing on Nilambur Valley, Nedumkayam rainforest, Conolly&apos;s Plot teak plantation, and bamboo groves along Chaliyar river.
                </div>
              </TabsContent>
              <TabsContent value="coastal" className="pt-4">
                <div className="rounded-lg border border-border/80 bg-background p-4 text-sm text-text-secondary">
                  Focusing on Kadalundi bird sanctuary, Vallikkunnu beach, Padinharekara beach confluence, and Ponnani fishing harbor.
                </div>
              </TabsContent>
              <TabsContent value="heritage" className="pt-4">
                <div className="rounded-lg border border-border/80 bg-background p-4 text-sm text-text-secondary">
                  Focusing on Kottakkal Arya Vaidya Sala, Thirunavaya Mamankam historical site, and traditional martial arts (Kalaripayattu) centers.
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* SECTION 8: DROPDOWNS & MODALS */}
        <section id="overlays" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              8. Dropdowns & Modal Dialogs
            </h2>
            <p className="text-sm text-text-secondary">
              Accessible overlay components with focus trapping, backdrop blur, and keyboard dismissal.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-card flex flex-wrap items-center gap-4">
            {/* Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Trip Action Menu <ChevronDown className="ml-2 h-4 w-4 text-text-secondary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Malappuram Planner</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => toast.info("Opening Nilambur route map...")}>
                    <Navigation className="mr-2 h-4 w-4 text-primary" />
                    <span>View Offline Route</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Exporting itinerary PDF...")}>
                    <Calendar className="mr-2 h-4 w-4 text-secondary" />
                    <span>Export 3-Day Plan</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Contacting Malappuram DTPC desk...")}>
                    <Phone className="mr-2 h-4 w-4 text-accent" />
                    <span>Tourism Desk Help</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toast.success("Shared itinerary link copied!")}>
                  <Share2 className="mr-2 h-4 w-4 text-text-secondary" />
                  <span>Share Road Link</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Modal Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default">
                  <Eye className="mr-2 h-4 w-4" />
                  Open Quick View Modal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="subtle">Destination Preview</Badge>
                  </div>
                  <DialogTitle>Nilambur Teak Reserve & Museum</DialogTitle>
                  <DialogDescription>
                    Explore one of Kerala&apos;s most iconic forestry heritage locations, located 40km from Malappuram town.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div className="rounded-lg bg-slate-100 p-4 space-y-2 text-sm text-text-primary">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Location:</span>
                      <span className="font-semibold">Nilambur, Kerala 679329</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Timings:</span>
                      <span className="font-semibold">09:00 AM – 05:00 PM</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Best Visiting Hours:</span>
                      <span className="font-semibold">Early morning (09:00 – 11:30 AM)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Permits:</span>
                      <span className="font-semibold text-primary">Issued on-site</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setIsDialogOpen(false);
                      toast.success("Destination added to your upcoming Malappuram trip!");
                    }}
                  >
                    Add to Trip Plan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* SECTION 9: TOASTS & FEEDBACK NOTIFICATIONS */}
        <section id="toasts" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              9. Toast Notifications (Sonner System)
            </h2>
            <p className="text-sm text-text-secondary">
              Real-time feedback banners with semantic color borders and custom typography.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-card flex flex-wrap items-center gap-3">
            <Button
              variant="default"
              onClick={() => {
                toast.success("Destination Saved!", {
                  description: "Kottakkal Arya Vaidya Sala added to your Malappuram itinerary.",
                });
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Trigger Success Toast
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                toast.info("Tide Advisory at Kadalundi", {
                  description: "High tide expected at 03:45 PM. Boat safaris recommended before noon.",
                });
              }}
            >
              <Info className="mr-2 h-4 w-4" /> Trigger Info Toast
            </Button>

            <Button
              variant="accent"
              onClick={() => {
                toast.warning("Monsoon Weather Alert", {
                  description: "Light showers reported along Nilambur Ghat road. Drive carefully.",
                });
              }}
            >
              <AlertTriangle className="mr-2 h-4 w-4" /> Trigger Warning Toast
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                toast.error("Offline Map Download Failed", {
                  description: "Unable to cache Kadalundi terrain data. Please verify your connection.",
                });
              }}
            >
              <AlertCircle className="mr-2 h-4 w-4" /> Trigger Error Toast
            </Button>
          </div>
        </section>

        {/* SECTION 10: EMPTY & ERROR STATES */}
        <section id="states" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              10. Empty & Error States
            </h2>
            <p className="text-sm text-text-secondary">
              Standardized fallback components preventing blank screens during zero-result queries or network errors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Empty State Component */}
            <EmptyState
              icon={Compass}
              title="No Saved Itineraries Found"
              description="You haven&apos;t added any attractions to your Malappuram trip yet. Discover nature spots, heritage museums, and river trails to begin."
              actionLabel="Explore Attractions"
              onAction={() => {
                toast.info("Navigating to Malappuram destination catalog...");
              }}
            />

            {/* Error State Component */}
            <ErrorState
              title="Unable to Load Live Ferry Schedule"
              description="We could not sync the latest boat departure timetable for Kadalundi Estuary."
              errorMessage="Error: 503 SERVICE_UNAVAILABLE (Boat Jetty API)"
              retryLabel="Retry Sync"
              onRetry={() => {
                toast.success("Ferry schedule re-synchronized successfully!");
              }}
            />
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-border bg-surface py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <span className="font-semibold text-text-primary">My Travelroad</span>
            <span>• UI Design System Foundation</span>
          </div>
          <div>
            Built with Next.js, TypeScript, Tailwind CSS, shadcn/ui & Lucide React.
          </div>
        </div>
      </footer>
    </div>
  );
}
