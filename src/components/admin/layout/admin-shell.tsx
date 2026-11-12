"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/admin/feedback/confirm-dialog";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";
import { findActiveAdminNavItem, type AdminNavItem } from "./navigation";

export interface AdminMainContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** Main scrollable admin content container with consistent max width and spacing. */
export function AdminMainContainer({
  children,
  className,
  ...props
}: AdminMainContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Full admin layout wrapper coordinating sidebar, header, main workspace, and confirmation dialogs. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = React.useState(false);

  const activeItem = findActiveAdminNavItem(pathname);
  const selectedNavId = activeItem?.id ?? "overview";
  const activeItemLabel = activeItem?.label ?? "Admin Console";

  const handleSelectPlaceholder = (item: AdminNavItem) => {
    adminToast.placeholder(item.label);
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-text-primary">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        activeItemId={selectedNavId}
        onSelectPlaceholder={handleSelectPlaceholder}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          activeItemId={selectedNavId}
          activeItemLabel={activeItemLabel}
          onSelectPlaceholder={handleSelectPlaceholder}
          onRequestSignOut={() => setSignOutDialogOpen(true)}
        />

        <main className="flex-1 min-w-0">
          <AdminMainContainer>{children}</AdminMainContainer>
        </main>

        <footer className="border-t border-border bg-surface/60 px-4 py-3 text-xs text-text-secondary sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span>My Travelroad Admin Console (Structural UI Preview)</span>
            <span>Development sample components only — auth &amp; backend excluded</span>
          </div>
        </footer>
      </div>

      <ConfirmDialog
        open={signOutDialogOpen}
        onOpenChange={setSignOutDialogOpen}
        title="Sign out of Admin Preview?"
        description="Authentication is not enabled yet. Confirming demonstrates standard session exit dialog behavior."
        targetLabel="Amina Rahman (Preview)"
        variant="warning"
        confirmLabel="Simulate Sign Out"
        onConfirm={() =>
          adminToast.info(
            "Sign-out confirmation triggered (Preview)",
            "Admin authentication will be integrated in a future task."
          )
        }
      />
    </div>
  );
}
