"use client";

import type { ReactNode } from "react";

import { useInView } from "@repo/ui/hooks/use-in-view";

// Far enough ahead that a widget is usually ready by the time it scrolls in.
const ROOT_MARGIN = "200px";

// Used where the caller has no grid to derive a height from, e.g. the editor.
const DEFAULT_INTRINSIC_HEIGHT = 400;

/**
 * Holds a widget's content back until its card comes near the viewport, so a
 * long dashboard neither queries nor draws what nobody has scrolled to. Once
 * mounted it stays mounted, so scrolling back never re-runs a query.
 *
 * Mounted is not free, though: a chart of any size is thousands of SVG nodes,
 * and the browser restyles and re-layerizes all of them on every viewport
 * change. `content-visibility` takes the ones nobody is looking at out of that
 * work while leaving them mounted, which measured at roughly a third off style
 * recalculation and not far off half the compositing on a dashboard of eleven
 * charts. It is only safe alongside the chart-side deferral that stops Plotly
 * resizing an off-screen chart, because Plotly decides a plot is hidden from
 * `display` alone and would otherwise lay out against a skipped subtree.
 */
interface LazyWidgetProps {
  children: ReactNode;
  /** What a skipped widget reserves in px, so scroll height holds steady. */
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
