"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";

import {
  Alert,
  AlertDescription,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

interface ExperimentDataTableErrorCellProps {
  error: string | null | undefined;
  className?: string;
}

/**
 * Component to display error information for a data table row.
 * Shows an error icon that opens a popover with the full error message.
 */
export function ExperimentDataTableErrorCell({
  error,
  className,
}: ExperimentDataTableErrorCellProps) {
  // If no error, don't render anything
  if (!error) {
    return null;
  }

  return (
    <div className={cn("flex items-center justify-start", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-destructive hover:text-destructive/80 flex items-center gap-1.5 transition-colors"
            aria-label="View error details"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Error</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="mt-2 max-h-60 overflow-y-auto text-sm">
              {error}
            </AlertDescription>
          </Alert>
        </PopoverContent>
      </Popover>
    </div>
  );
}
