"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Compass, ExternalLink, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "./navigation";
import { AdminNavIcon } from "./admin-nav-icon";

export interface AdminMobileNavProps {
  activeItemId: string;
  onSelectPlaceholder: (item: AdminNavItem) => void;
}

/** Accessible responsive mobile navigation drawer for the admin workspace. */
export function AdminMobileNav({
  activeItemId,
  onSelectPlaceholder,
}: AdminMobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Open admin navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />

        <DialogPrimitive.Content
          aria-label="Admin mobile navigation"
          className="fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-xs flex-col border-r border-border bg-surface shadow-modal duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden"
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Link
              href="/admin/design-system"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-subtle">
                <Compass className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-heading text-sm font-bold text-text-primary">
                  My Travelroad
                </span>
                <span className="text-[11px] text-text-secondary">
                  Admin Console
                </span>
              </div>
            </Link>

            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close admin navigation"
              >
                <X className="h-5 w-5 text-text-secondary" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Title className="sr-only">
            Admin Console Navigation
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Browse admin navigation modules and return to the public site.
          </DialogPrimitive.Description>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  {group.label}
                </p>
                <nav aria-label={`${group.label} mobile`} className="space-y-1">
                  {group.items.map((item) => {
                    const isRouteActive =
                      item.href &&
                      (pathname === item.href || pathname.startsWith(`${item.href}/`));
                    const isSelected = Boolean(
                      isRouteActive || activeItemId === item.id
                    );

                    const itemClasses = cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-text-secondary hover:bg-muted hover:text-text-primary"
                    );

                    if (item.href && !item.isPlaceholder) {
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={isSelected ? "page" : undefined}
                          className={itemClasses}
                        >
                          <AdminNavIcon iconKey={item.iconKey} />
                          <span className="flex-1 truncate text-left">{item.label}</span>
                          {item.badgeText && (
                            <Badge variant="subtle" size="sm">
                              {item.badgeText}
                            </Badge>
                          )}
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          onSelectPlaceholder(item);
                          setOpen(false);
                        }}
                        className={itemClasses}
                      >
                        <AdminNavIcon iconKey={item.iconKey} />
                        <span className="flex-1 truncate text-left">{item.label}</span>
                        {item.badgeText && (
                          <Badge variant="muted" size="sm">
                            {item.badgeText}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-slate-50/70 p-4">
            <Button variant="outline" size="sm" asChild className="w-full justify-center">
              <Link href="/" onClick={() => setOpen(false)}>
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                View Public Site
              </Link>
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
