"use client";

import { X } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

interface CalibrationRowRemoveProps {
  label: string;
  onRemove: () => void;
  /** The group-hover class that reveals it, since each row names its own group. */
  revealClassName: string;
  disabled?: boolean;
  hidden?: boolean;
}

/**
 * A row's remove control: out of sight until the row is hovered, but always there for a
 * keyboard (it shows on focus) and on a touch screen, which has no hover to reveal it.
 */
export function CalibrationRowRemove({
  label,
  onRemove,
  revealClassName,
  disabled = false,
  hidden = false,
}: CalibrationRowRemoveProps) {
  return (
    <span className="flex h-7 items-center self-start">
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "text-muted-foreground/0 hover:bg-muted hover:text-destructive! focus-visible:text-muted-foreground focus-visible:ring-ring [@media(hover:none)]:text-muted-foreground/70 inline-flex size-6 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1",
          revealClassName,
          hidden && "hidden",
        )}
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}
