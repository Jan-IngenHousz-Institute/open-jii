"use client";

import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface ToolbarShellProps {
  visible: boolean;
  children: ReactNode;
}

// Shared chrome between DashboardModebar and DashboardToolbar: the floating
// glass pill at the bottom of the canvas. `data-toolbar-shell` is the anchor
// StripOverflowList walks up to so it can measure against the canvas width
// (the pill itself is w-fit and would hide width gains).
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
        "gap-1 rounded-full border p-1 shadow-lg backdrop-blur-sm",
        "transition-[transform,opacity] duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-40 opacity-0",
      )}
    >
      {children}
    </div>
  );
}
