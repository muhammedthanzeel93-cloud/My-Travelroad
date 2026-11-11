"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Compass,
  Menu,
  X,
  User,
  LogIn,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PRIMARY_NAV_LINKS,
  FOOTER_CATEGORY_LINKS,
  type NavLinkItem,
} from "./navigation";

function isLinkActive(pathname: string, link: NavLinkItem): boolean {
  if (link.href === "/") {
    return pathname === "/";
  }
  return link.matchPrefix
    ? pathname === link.href || pathname.startsWith(`${link.href}/`)
    : pathname === link.href;
}

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />

        <DialogPrimitive.Content
          aria-label="Mobile navigation"
          className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xs flex-col border-l border-border bg-surface shadow-modal duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Compass className="h-5 w-5" />
              </span>
              <span className="font-heading text-base font-bold tracking-tight text-text-primary">
                My Travelroad
              </span>
            </Link>

            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5 text-text-secondary" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Title className="sr-only">
            Site Navigation Menu
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Navigate across discovery, category, and account pages.
          </DialogPrimitive.Description>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
            <div>
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Explore Malappuram
              </p>
              <nav aria-label="Primary mobile navigation" className="mt-2 space-y-1">
                {PRIMARY_NAV_LINKS.map((link) => {
                  const active = isLinkActive(pathname, link);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-text-primary hover:bg-muted"
                      )}
                    >
                      <span>{link.label}</span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4",
                          active ? "text-primary" : "text-text-secondary/60"
                        )}
                      />
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-border pt-5">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Categories
              </p>
              <nav aria-label="Category mobile navigation" className="mt-2 space-y-1">
                {FOOTER_CATEGORY_LINKS.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-secondary/10 text-secondary font-semibold"
                          : "text-text-secondary hover:bg-muted hover:text-text-primary"
                      )}
                    >
                      <span>{link.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-border pt-5 space-y-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Account (Preview)
              </p>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/profile"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-text-primary hover:bg-muted"
                )}
              >
                <User className="h-4 w-4 text-text-secondary" />
                <span>Traveler Profile</span>
              </Link>
            </div>
          </div>

          {/* Drawer Footer Auth Links */}
          <div className="border-t border-border bg-slate-50/70 p-4 grid grid-cols-2 gap-2.5">
            <Button variant="outline" size="sm" asChild>
              <Link href="/login" onClick={() => setOpen(false)}>
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Sign In
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link href="/register" onClick={() => setOpen(false)}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Register
              </Link>
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
