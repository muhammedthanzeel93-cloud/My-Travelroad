import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AdminFormSectionProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Structured section container grouping related admin form fields with optional footer action bar. */
export function AdminFormSection({
  title,
  description,
  badge,
  children,
  footer,
  className,
}: AdminFormSectionProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b border-border/70 bg-slate-50/50 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
              {badge}
            </div>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-5">{children}</CardContent>

      {footer && (
        <CardFooter className="border-t border-border/70 bg-slate-50/50 px-6 py-4">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}

/** Responsive alignment helper for admin form submit / reset / cancel buttons. */
export function AdminFormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}
