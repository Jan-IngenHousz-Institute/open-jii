"use client";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components";

interface ErrorDisplayProps {
  error: unknown;
  title?: string;
}

/**
 * Component to display errors consistently throughout the application
 */
export function ErrorDisplay({ error, title = "Error" }: ErrorDisplayProps) {
  // Extract a useful message from the error object
  const getErrorMessage = (err: unknown): string => {
    if (!err) return "An unknown error occurred";
    if (typeof err === "string") return err;

    // Check for standard Error objects
    if (err instanceof Error) return err.message;

    // Check for API error responses
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof err === "object" && err !== null) {
      // @ts-expect-error - custom error structure
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      if (err.body?.message) return err.body.message;

      // Try to stringify the object if all else fails
      try {
        return JSON.stringify(err);
      } catch {
        return "An error occurred";
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(err);
  };

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{getErrorMessage(error)}</AlertDescription>
    </Alert>
  );
}
