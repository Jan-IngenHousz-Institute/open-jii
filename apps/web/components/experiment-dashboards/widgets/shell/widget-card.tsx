"use client";

import { createContext, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

// Portal slot above the clipped inner frame so escape-hatch CTAs can render outside it.
export const WidgetCardTabSlotContext = createContext<HTMLDivElement | null>(null);

const ROOT_INTERACTIVE_CLASS =
  "focus-visible:ring-primary/40 focus-visible:outline-none focus-visible:ring-2";
const ROOT_BASE_CLASS = "group/widget relative flex h-full w-full flex-col";
const INNER_BASE_CLASS =
  "bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow]";
// Drop rounded corners so resize handles align with the box corners.
const INNER_SELECTED_CLASS =
  "dashboard-widget--selected border-primary rounded-none shadow-[0_0_0_1px_hsl(var(--primary))]";

interface WidgetCardProps {
  children: ReactNode;
  className?: string;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function WidgetCard({ children, className, isSelected, onSelect }: WidgetCardProps) {
  const [tabSlotEl, setTabSlotEl] = useState<HTMLDivElement | null>(null);
  const isInteractive = Boolean(onSelect);

  const handleFocus = () => {
    if (onSelect && !isSelected) {
      onSelect();
    }
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onSelect) {
      return;
    }
    event.stopPropagation();
    onSelect();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) {
      return;
    }
    // Activate only on the card's own keystroke; bubbled events from
    // descendants (e.g. rich-text editor space) must pass through.
    if (event.target !== event.currentTarget) {
      return;
    }
    const isActivationKey = event.key === "Enter" || event.key === " ";
    if (!isActivationKey) {
      return;
    }
    event.preventDefault();
    onSelect();
  };

  const rootClass = cn(ROOT_BASE_CLASS, isInteractive && ROOT_INTERACTIVE_CLASS);
  const innerClass = cn(INNER_BASE_CLASS, isSelected && INNER_SELECTED_CLASS, className);

  return (
    <div
      data-dashboard-widget=""
      // No role="button": ARIA forbids interactive descendants inside one.
      aria-current={isInteractive && isSelected ? "true" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onFocus={handleFocus}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={rootClass}
    >
      <div
        ref={setTabSlotEl}
        className="pointer-events-none absolute inset-x-0 bottom-full z-20 flex h-7 items-end justify-end px-4"
      />
      <WidgetCardTabSlotContext.Provider value={tabSlotEl}>
        <div className={innerClass}>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </WidgetCardTabSlotContext.Provider>
    </div>
  );
}
