"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRIMARY_NAV_LINKS, type NavLinkItem } from "./navigation";
import { MobileNav } from "./mobile-nav";

function isNavActive(pathname: string, item: NavLinkItem): boolean {
  if (item.href === "/") {
    return pathname === "/";
  }
  return item.matchPrefix
    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
    : pathname === item.href;
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Compass className="h-5 w-5 stroke-[2]" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-heading text-base sm:text-lg font-bold tracking-tight text-text-primary">
                My Travelroad
              </span>
              <Badge variant="subtle" size="sm" className="hidden xs:inline-flex">
                Malappuram
              </Badge>
            </div>
          </div>
        </Link>

        {/* Desktop Primary Navigation */}
        <nav aria-label="Primary desktop navigation" className="hidden lg:flex items-center gap-1">
          {PRIMARY_NAV_LINKS.map((item) => {
            const active = isNavActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-text-secondary hover:bg-muted hover:text-text-primary"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Utility & Account Actions */}
        <div className="hidden lg:flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            aria-label="Search destinations"
          >
            <Link href="/search">
              <Search className="h-4 w-4 text-text-secondary" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            aria-label="Saved destinations"
          >
            <Link href="/saved">
              <Heart className="h-4 w-4 text-text-secondary" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(pathname === "/profile" && "bg-muted text-primary font-semibold")}
          >
            <Link href="/profile">
              <User className="mr-1.5 h-4 w-4" />
              Profile
            </Link>
          </Button>

          <div className="h-5 w-px bg-border mx-1" aria-hidden="true" />

          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link href="/register">Register</Link>
          </Button>
        </div>

        {/* Mobile / Tablet Quick Actions + Drawer Trigger */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Search destinations"
          >
            <Link href="/search">
              <Search className="h-5 w-5 text-text-secondary" />
            </Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
