import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section";
  spacing?: "none" | "compact" | "default" | "relaxed";
}

const spacingClasses: Record<NonNullable<PageContainerProps["spacing"]>, string> = {
  none: "",
  compact: "py-6 sm:py-8",
  default: "py-8 sm:py-12",
  relaxed: "py-12 sm:py-16",
};

export function PageContainer({
  as: Component = "div",
  spacing = "none",
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <Component
      className={cn(
        "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8",
        spacingClasses[spacing],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
