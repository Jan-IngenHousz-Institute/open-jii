"use client";

import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { useWidgetHeaderSlot } from "./widget-card";

interface WidgetActionsProps {
  /** Menu items rendered inside the dropdown. */
  children: ReactNode;
  ariaLabel: string;
}

/**
 * Renders a kebab dropdown into the widget's header slot. Each editor
 * variant calls `<WidgetActions>` somewhere in its tree; we look up the
 * slot from `WidgetCard`'s context and `createPortal` the trigger button
 * into the header bar so editing affordances are anchored to a stable,
 * visible surface instead of floating over the body.
 *
 * If there's no slot (e.g. the read-only renderer doesn't render a
 * header), this component returns `null` — actions are editor-only.
 */
export function WidgetActions({ children, ariaLabel }: WidgetActionsProps) {
  const slot = useWidgetHeaderSlot();
  if (!slot) return null;

  return createPortal(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          // Stop pointerdown propagation so RGL doesn't treat a click on
          // the kebab as the start of a drag.
          onPointerDown={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-primary/40 data-[state=open]:bg-accent data-[state=open]:text-foreground inline-flex size-6 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>,
    slot,
  );
}
