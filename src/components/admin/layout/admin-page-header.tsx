import * as React from "react";
import {
  AdminBreadcrumbs,
  type AdminBreadcrumbItem,
} from "./admin-breadcrumbs";
import { cn } from "@/lib/utils";

export interface AdminPageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: AdminBreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Standardized top page header for admin views supporting breadcrumbs, badges, and action groups. */
export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-6",
        className
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <AdminBreadcrumbs items={breadcrumbs} />
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="max-w-3xl text-sm text-text-secondary leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
