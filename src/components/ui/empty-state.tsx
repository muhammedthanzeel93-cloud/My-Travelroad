import * as React from "react";
import { type LucideIcon, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionComponent?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Compass,
  title,
  description,
  actionLabel,
  onAction,
  actionComponent,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-8 text-center sm:p-12",
        className
      )}
      {...props}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-7 w-7 stroke-[1.75]" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-text-primary sm:text-lg">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-text-secondary leading-relaxed">
        {description}
      </p>
      {actionComponent ? (
        <div className="mt-6">{actionComponent}</div>
      ) : actionLabel && onAction ? (
        <Button onClick={onAction} variant="default" className="mt-6">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
