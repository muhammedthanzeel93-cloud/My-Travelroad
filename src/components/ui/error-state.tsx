import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  errorMessage?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "Unable to load travel data",
  description = "Something went wrong while retrieving destination details. Please check your connection and try again.",
  errorMessage,
  onRetry,
  retryLabel = "Try again",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-red-200/80 bg-red-50/40 p-8 text-center sm:p-10",
        className
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-destructive">
        <AlertCircle className="h-6 w-6 stroke-[2]" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-text-primary sm:text-lg">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-text-secondary leading-relaxed">
        {description}
      </p>
      {errorMessage && (
        <code className="mt-3 rounded bg-red-100/70 px-2.5 py-1 text-xs text-red-800 font-mono">
          {errorMessage}
        </code>
      )}
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-5 border-red-200 text-destructive hover:bg-red-50 hover:border-red-300"
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
