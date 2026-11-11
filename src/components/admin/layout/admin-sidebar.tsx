"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "./navigation";
import { AdminNavIcon } from "./admin-nav-icon";

export interface AdminSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeItemId: string;
  onSelectPlaceholder: (item: AdminNavItem) => void;
}

/** Collapsible desktop admin sidebar navigation built with My Travelroad tokens. */
export function AdminSidebar({
  collapsed,
  onToggleCollapse,
  activeItemId,
  onSelectPlaceholder,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Admin sidebar navigation"
      className={cn(
        "hidden lg:flex lg:flex-col lg:shrink-0 border-r border-border bg-surface transition-[width] duration-200 sticky top-0 h-screen",
        collapsed ? "w-[76px]" : "w-72"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-border px-4",
          collapsed ? "justify-center" : "justify-between gap-2"
        )}
      >
        <Link
          href="/admin/design-system"
          aria-label="My Travelroad Admin"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-subtle">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </span>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-heading text-sm font-bold tracking-tight text-text-primary">
                My Travelroad
              </span>
              <span className="text-[11px] font-medium text-text-secondary">
                Admin Console
              </span>
            </div>
          )}
        </Link>

        {!collapsed && (
          <Badge variant="subtle" size="sm">
            v0.3
          </Badge>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1.5">
            {!collapsed && (
              <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                {group.label}
              </p>
            )}
            <nav aria-label={group.label} className="space-y-1">
              {group.items.map((item) => {
                const isRouteActive =
                  item.href &&
                  (pathname === item.href || pathname.startsWith(`${item.href}/`));
                const isSelected = Boolean(isRouteActive || activeItemId === item.id);

                const itemClasses = cn(
                  "group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  collapsed && "justify-center px-2",
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-text-secondary hover:bg-muted hover:text-text-primary"
                );

                const content = (
                  <>
                    <AdminNavIcon
                      iconKey={item.iconKey}
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected
                          ? "text-primary"
                          : "text-text-secondary group-hover:text-text-primary"
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left leading-snug">{item.label}</span>
                        {item.badgeText && (
                          <Badge
                            variant={item.isPlaceholder ? "muted" : "subtle"}
                            size="sm"
                            className="shrink-0"
                          >
                            {item.badgeText}
                          </Badge>
                        )}
                      </>
                    )}
                  </>
                );

                if (item.href && !item.isPlaceholder) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={isSelected ? "page" : undefined}
                      className={itemClasses}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={collapsed ? `${item.label} (Placeholder)` : undefined}
                    aria-label={collapsed ? `${item.label} (Placeholder)` : undefined}
                    aria-pressed={isSelected}
                    onClick={() => onSelectPlaceholder(item)}
                    className={itemClasses}
                  >
                    {content}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border p-3 space-y-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          asChild
          className={cn(
            "w-full text-text-secondary hover:text-primary",
            !collapsed && "justify-start"
          )}
        >
          <Link
            href="/"
            title={collapsed ? "View Public Site" : undefined}
            aria-label={collapsed ? "View Public Site" : undefined}
          >
            <ExternalLink className={cn("h-4 w-4 shrink-0", !collapsed && "mr-2")} />
            {!collapsed && <span>View Public Site</span>}
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          size={collapsed ? "icon" : "sm"}
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("w-full", !collapsed && "justify-start")}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="mr-2 h-4 w-4 shrink-0" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
