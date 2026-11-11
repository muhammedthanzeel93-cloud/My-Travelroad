"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ExternalLink,
  LogOut,
  Palette,
  Settings,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADMIN_SAMPLE_NOTIFICATIONS,
  ADMIN_SAMPLE_USER,
} from "@/data/admin-sample-data";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import { AdminMobileNav } from "./admin-mobile-nav";
import type { AdminNavItem } from "./navigation";

export interface AdminHeaderProps {
  activeItemId: string;
  activeItemLabel: string;
  onSelectPlaceholder: (item: AdminNavItem) => void;
  onRequestSignOut: () => void;
}

/** Sticky top admin bar featuring mobile nav drawer trigger, notifications menu, and account menu. */
export function AdminHeader({
  activeItemId,
  activeItemLabel,
  onSelectPlaceholder,
  onRequestSignOut,
}: AdminHeaderProps) {
  const router = useRouter();
  const unreadCount = ADMIN_SAMPLE_NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      {/* Left: Mobile Drawer Trigger + Context Title */}
      <div className="flex items-center gap-3 min-w-0">
        <AdminMobileNav
          activeItemId={activeItemId}
          onSelectPlaceholder={onSelectPlaceholder}
        />

        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-text-primary sm:text-base">
            {activeItemLabel}
          </span>
          <Badge variant="accentSubtle" size="sm" className="hidden xs:inline-flex shrink-0">
            Admin Foundation
          </Badge>
        </div>
      </div>

      {/* Right: Notification Area + User Account Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Notification Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Notifications (${unreadCount} unread sample notices)`}
              className="relative"
            >
              <Bell className="h-4 w-4 text-text-secondary" />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface"
                />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2.5 py-1.5">
              <DropdownMenuLabel className="p-0">
                Sample Notifications
              </DropdownMenuLabel>
              <Badge variant="muted" size="sm">
                {unreadCount} unread
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <div className="divide-y divide-border/70">
              {ADMIN_SAMPLE_NOTIFICATIONS.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() =>
                    adminToast.info(item.title, "Sample notification preview only.")
                  }
                  className="flex cursor-pointer flex-col items-start gap-1 py-2.5"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {item.title}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        item.unread ? "bg-accent" : "bg-slate-300"
                      )}
                    />
                  </div>
                  <p className="text-xs text-text-secondary leading-snug">
                    {item.description}
                  </p>
                  <span className="text-[11px] text-text-secondary/80">
                    {item.timestamp}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Account Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Open admin account menu"
              className="flex items-center gap-2 rounded-full pl-1 pr-2.5 hover:bg-muted"
            >
              <Avatar size="sm" status={ADMIN_SAMPLE_USER.status}>
                <AvatarFallback>{ADMIN_SAMPLE_USER.initials}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-left leading-tight">
                <span className="text-xs font-semibold text-text-primary">
                  {ADMIN_SAMPLE_USER.name}
                </span>
                <span className="text-[11px] text-text-secondary">
                  {ADMIN_SAMPLE_USER.role}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2.5 py-2">
              <p className="text-sm font-semibold text-text-primary truncate">
                {ADMIN_SAMPLE_USER.name}
              </p>
              <p className="text-xs text-text-secondary truncate">
                {ADMIN_SAMPLE_USER.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => adminToast.placeholder("Admin Profile")}
            >
              <User className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <span>Account Profile (Planned)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => adminToast.placeholder("Admin Preferences")}
            >
              <Settings className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <span>Workspace Settings (Planned)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => router.push("/admin/design-system")}
            >
              <Palette className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Admin Design System</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => router.push("/")}
            >
              <ExternalLink className="h-4 w-4 text-secondary" aria-hidden="true" />
              <span>View Public Site</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-destructive focus:bg-red-50 focus:text-destructive"
              onSelect={onRequestSignOut}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign Out (Confirm Demo)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
