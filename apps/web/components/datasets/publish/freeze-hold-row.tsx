"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

interface FreezeHoldRowProps {
  title: string;
  actionLabel: string;
  onAction: () => void;
  /** Next was pressed while it remained, so it turns from a to-do into an error. */
  isBlocked: boolean;
}

/** One thing Freeze waits for, in the amber of a step left until Next is pressed. */
export function FreezeHoldRow({ title, actionLabel, onAction, isBlocked }: FreezeHoldRowProps) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        isBlocked ? "border-destructive/60" : "border-status-stale-foreground/30",
      )}
    >
      <TriangleAlert
        className={cn(
          "size-4 shrink-0",
          isBlocked ? "text-destructive" : "text-status-stale-foreground",
        )}
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm font-medium">{title}</p>
      <Button type="button" variant="outline" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </li>
  );
}
