"use client";

import type { ReactNode } from "react";

import { useInView } from "@repo/ui/hooks/use-in-view";

// Far enough ahead that a widget is usually ready by the time it scrolls in.
const ROOT_MARGIN = "200px";

/**
 * Holds a widget's content back until its card comes near the viewport, so a
 * long dashboard neither queries nor draws what nobody has scrolled to. Once
 * mounted it stays mounted, so scrolling back never re-runs a query.
 */
export function LazyWidget({ children }: { children: ReactNode }) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: ROOT_MARGIN });

  return (
    <div ref={ref} className="flex h-full min-h-0 flex-1 flex-col">
      {inView ? children : null}
    </div>
  );
}
