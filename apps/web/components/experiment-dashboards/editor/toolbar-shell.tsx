"use client";

import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface ToolbarShellProps {
  visible: boolean;
  children: ReactNode;
}

// `data-toolbar-shell` anchors StripOverflowList's width measurement (the pill is w-fit).
// Hide via opacity only — a `translate-y-40` on a `position: sticky` element
// extends Chrome's overflow / scroll-area calculation so the visible viewport
// shows a white strip below the gradient body where the phantom-positioned
// pill is layout-shifted. Fading without translate keeps both shells mounted
// (preserves cross-fade between modebar ↔ toolbar) without disturbing layout.
export function ToolbarShell({ visible, children }: ToolbarShellProps) {
  return (
    <div
      data-toolbar-shell=""
      data-editor-chrome=""
      data-no-drag=""
      aria-hidden={!visible ? "true" : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "bg-card/90 sticky bottom-6 z-30 mx-auto flex w-fit max-w-full items-center",
        "backdrop-blur-xs gap-1 rounded-full border p-1 shadow-lg",
        "transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {children}
    </div>
  );
}
