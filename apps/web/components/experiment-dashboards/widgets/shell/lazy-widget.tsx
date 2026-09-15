"use client";

import type { ReactNode } from "react";

import { useInView } from "@repo/ui/hooks/use-in-view";

// Far enough ahead that a widget is usually ready by the time it scrolls in.
const ROOT_MARGIN = "200px";

// Fallback for callers with no grid row height to derive one from.
const DEFAULT_INTRINSIC_HEIGHT = 400;

/**
 * Holds a widget's content back until its card comes near the viewport, and
 * keeps it mounted once shown so scrolling back never refetches. Unseen
 * widgets stay out of style and compositing work via `content-visibility`,
 * which is only safe because the chart defers its own resize while off-screen:
 * Plotly reads `display` to decide a plot is hidden, so it would otherwise
 * lay out against a subtree the browser is skipping.
 */
interface LazyWidgetProps {
  children: ReactNode;
  intrinsicHeight?: number;
}

export function LazyWidget({ children, intrinsicHeight }: LazyWidgetProps) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: ROOT_MARGIN });

  return (
    <div
      ref={ref}
      className="flex h-full min-h-0 flex-1 flex-col [content-visibility:auto]"
      style={{
        containIntrinsicSize: `auto ${intrinsicHeight ?? DEFAULT_INTRINSIC_HEIGHT}px`,
      }}
    >
      {inView ? children : null}
    </div>
  );
}
