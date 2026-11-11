"use client";

import * as React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  targetLabel?: string;
  variant?: "default" | "warning" | "destructive";
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
}

/** Accessible admin confirmation dialog preventing unguarded destructive or sensitive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  targetLabel,
  variant = "destructive",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const isDestructive = variant === "destructive";
  const isWarning = variant === "warning";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                isDestructive && "bg-red-100 text-destructive",
                isWarning && "bg-amber-100 text-amber-800",
                variant === "default" && "bg-primary/10 text-primary"
              )}
            >
              {isDestructive ? (
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-1.5 pr-4">
              <DialogTitle className="text-base sm:text-lg leading-snug">
                {title}
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>

          {targetLabel && (
            <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs text-text-secondary flex items-center justify-between gap-2">
              <span className="truncate font-medium text-text-primary">
                {targetLabel}
              </span>
              <Badge variant="muted" size="sm">
                Preview Target
              </Badge>
            </div>
          )}
        </DialogHeader>

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={
              isDestructive ? "destructive" : isWarning ? "accent" : "default"
            }
            isLoading={isLoading}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
