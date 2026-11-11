"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface AdminDropdownAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface AdminDropdownMenuProps {
  trigger: React.ReactNode;
  label?: string;
  items: AdminDropdownAction[];
  align?: "start" | "center" | "end";
  className?: string;
}

/** Data-driven dropdown menu built on Task 01 DropdownMenu primitives. */
export function AdminDropdownMenu({
  trigger,
  label,
  items,
  align = "end",
  className,
}: AdminDropdownMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("min-w-[12rem]", className)}>
        {label && (
          <>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <React.Fragment key={item.id}>
              {item.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "cursor-pointer gap-2",
                  item.destructive &&
                    "text-destructive focus:bg-red-50 focus:text-destructive"
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
