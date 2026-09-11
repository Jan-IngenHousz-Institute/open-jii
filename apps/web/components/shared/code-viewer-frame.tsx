"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

export interface CodeViewerFrameProps {
  /** Language name shown in the header, e.g. `JSON`, `Python`. */
  label: ReactNode;
  /** Pre-formatted line count and byte size — the caller owns the wording. */
  stats?: ReactNode;
  /** Optional name shown before the label, separated by a rule. */
  title?: ReactNode;
  /** Header controls — a copy button, a format toggle. */
  actions?: ReactNode;
  /** Present when the panel is clickable; also enables the hover overlay. */
  onEditStart?: () => void;
  /** The editor itself. */
  children: ReactNode;
  className?: string;
}

/**
 * Chrome around a read-only code panel: a bordered surface, a header reading
 * `title | LABEL  stats` with trailing controls, and a hover-to-edit overlay.
 */
export function CodeViewerFrame({
  label,
  stats,
  title,
  actions,
  onEditStart,
  children,
  className,
}: CodeViewerFrameProps) {
  return (
    <div
      data-testid="code-viewer-frame"
      className={cn(
        "group/viewer bg-card shadow-xs relative overflow-hidden rounded-md border transition-shadow duration-200 hover:shadow-md",
        onEditStart && "cursor-pointer",
        className,
      )}
      onClick={onEditStart}
    >
      {onEditStart ? (
        <div className="group-hover/viewer:bg-foreground/5 pointer-events-none absolute inset-0 z-10 flex cursor-pointer items-center justify-center transition-colors duration-200 group-hover/viewer:pointer-events-auto">
          <div className="bg-popover rounded-full p-3 opacity-0 shadow-lg transition-opacity duration-200 group-hover/viewer:opacity-100">
            <Pencil className="text-muted-foreground size-5" aria-hidden />
          </div>
        </div>
      ) : null}
      {/* Above the overlay, which spans inset-0 and would otherwise swallow
          clicks on the header controls. */}
      <div className="bg-muted relative z-20 flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          {title ? (
            <>
              <span className="text-foreground text-sm font-medium">{title}</span>
              <span className="text-muted-foreground/50" aria-hidden>
                |
              </span>
            </>
          ) : null}
          <span className="text-muted-foreground text-xs font-medium">{label}</span>
          {stats ? <span className="text-muted-foreground text-xs">{stats}</span> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
