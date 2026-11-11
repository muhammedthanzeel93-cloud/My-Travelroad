"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-text-primary group-[.toaster]:border-border group-[.toaster]:shadow-elevated group-[.toaster]:rounded-lg group-[.toaster]:p-4 group-[.toaster]:gap-3 group-[.toaster]:font-sans",
          description: "group-[.toast]:text-text-secondary text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:hover:bg-primary-hover font-medium text-xs px-3 py-1.5 rounded-md transition-colors",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-text-secondary font-medium text-xs px-3 py-1.5 rounded-md",
          success:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-primary",
          warning:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-accent",
          error:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-destructive",
          info:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-secondary",
        },
      }}
      {...props}
    />
  );
}
