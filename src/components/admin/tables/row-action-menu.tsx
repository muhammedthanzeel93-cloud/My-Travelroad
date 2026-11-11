"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminDropdownMenu,
  type AdminDropdownAction,
} from "@/components/admin/feedback/admin-dropdown-menu";

export interface RowActionMenuProps {
  rowLabel: string;
  actions: AdminDropdownAction[];
  menuLabel?: string;
}

/** Row-level action menu composing AdminDropdownMenu over an icon-only trigger button. */
export function RowActionMenu({
  rowLabel,
  actions,
  menuLabel = "Row Actions",
}: RowActionMenuProps) {
  return (
    <AdminDropdownMenu
      label={menuLabel}
      items={actions}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Open actions for ${rowLabel}`}
          className="text-text-secondary hover:text-text-primary"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      }
    />
  );
}
