"use client";

import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";

interface StepLoadErrorProps {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}

/** A failed read inside a step, kept apart from an empty answer so it is never read as one. */
export function StepLoadError({ message, retryLabel, onRetry }: StepLoadErrorProps) {
  return (
    <EmptyState
      variant="error"
      description={message}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    />
  );
}
