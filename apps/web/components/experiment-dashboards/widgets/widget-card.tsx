"use client";

import { GripVertical } from "lucide-react";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface WidgetCardProps {
  children: ReactNode;
  className?: string;
  /**
   * Selection state. When provided, clicking the card body fires
   * `onSelect` and a primary-coloured ring appears. The presence of
   * `onSelect` ALSO marks the card as editor-mode and renders a header
   * bar with the drag handle + kebab slot. Read-only callers omit this
   * and the card renders chrome-free.
   */
  isSelected?: boolean;
  onSelect?: () => void;
}

/**
 * Holds the DOM node where editor-mode widget actions (kebab) should
 * render. Editor variants of widgets (`<WidgetActions>`) consume this
 * via context and `createPortal` their trigger into the header bar.
 * `null` means there's no header (read-only mode), and consumers should
 * render nothing.
 */
const WidgetHeaderSlotContext = createContext<HTMLDivElement | null>(null);
export function useWidgetHeaderSlot() {
  return useContext(WidgetHeaderSlotContext);
}

export function WidgetCard({ children, className, isSelected, onSelect }: WidgetCardProps) {
  const isInteractive = Boolean(onSelect);
  // Use a state-backed ref so the slot context updates after the header
  // div mounts — `createPortal` consumers re-render and can target it.
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

  return (
    <div
      data-dashboard-widget=""
      role={isInteractive ? "button" : undefined}
      aria-pressed={isInteractive ? Boolean(isSelected) : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onFocus={() => {
        if (onSelect && !isSelected) onSelect();
      }}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onKeyDown={(e) => {
        if (!onSelect) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "bg-card group/widget relative flex h-full w-full flex-col overflow-hidden rounded-xl border transition-shadow",
        isSelected && "ring-primary ring-2",
        isInteractive &&
          "focus-visible:ring-primary/40 focus-visible:outline-none focus-visible:ring-2",
        className,
      )}
    >
      {isInteractive && (
        <header
          // Editor-mode chrome. Always reserved (not hover-only) so it's a
          // stable, predictable target — drag-handle on the left, actions
          // on the right. Read-only mode renders no header at all so the
          // dashboard preview matches the published view.
          className="bg-muted/30 text-muted-foreground flex h-9 shrink-0 items-center justify-between border-b px-2"
        >
          <div
            aria-label="Drag widget"
            // RGL's `dragConfig.handle` selector. Only this element starts
            // a drag — chart bodies stay interactive.
            className="dashboard-widget-drag-handle hover:text-foreground flex size-6 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </div>
          <div ref={setHeaderSlot} className="flex items-center gap-1" />
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <WidgetHeaderSlotContext.Provider value={headerSlot}>
          {children}
        </WidgetHeaderSlotContext.Provider>
      </div>
    </div>
  );
}
