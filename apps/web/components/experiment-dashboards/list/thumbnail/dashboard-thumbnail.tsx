"use client";

import { useMemo } from "react";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useElementSize } from "@repo/ui/hooks/use-element-size";
import { useInView } from "@repo/ui/hooks/use-in-view";

import { DashboardLayoutSkeleton } from "../../dashboard-layout-skeleton";
import { DashboardRenderer } from "../../dashboard-renderer";
import { DashboardThumbnailEmpty } from "./dashboard-thumbnail-empty";
import { ScaledFrame } from "./scaled-frame";
import { useEverLoaded } from "./use-ever-loaded";

interface DashboardThumbnailProps {
  dashboard: ExperimentDashboard;
  experimentId: string;
  maxHeight?: number;
}

// Render at this width then CSS-scale to fit; matches the editor's content column.
const INNER_WIDTH_PX = 1280;
const FALLBACK_ROW_COUNT = 4;

export function DashboardThumbnail({
  dashboard,
  experimentId,
  maxHeight = 200,
}: DashboardThumbnailProps) {
  const [widthRef, size] = useElementSize<HTMLDivElement>();
  const [inViewRef, mounted] = useInView<HTMLDivElement>({ rootMargin: "200px" });
  const width = size?.width ?? null;
  const everLoaded = useEverLoaded(experimentId, mounted);

  const setRefs = (node: HTMLDivElement | null) => {
    widthRef.current = node;
    inViewRef.current = node;
  };

  const isEmpty = dashboard.widgets.length === 0;
  const innerHeight = useMemo(() => computeInnerHeight(dashboard), [dashboard]);
  const hasDataWidgets = useMemo(
    () => dashboard.widgets.some((w) => w.type !== "richText"),
    [dashboard.widgets],
  );

  const isMeasured = mounted && width !== null;
  const scale = width ? width / INNER_WIDTH_PX : 0;
  const showSkeleton = !mounted || (hasDataWidgets && !everLoaded);
  const canRenderScaled = !isEmpty && isMeasured;
  const showSkeletonOverlay = !isEmpty && (!isMeasured || showSkeleton);
  const cardHeight = canRenderScaled ? Math.min(innerHeight * scale, maxHeight) : maxHeight;

  return (
    <div
      ref={setRefs}
      role="img"
      aria-label={dashboard.name}
      className="relative w-full overflow-hidden rounded-md"
      style={{ height: cardHeight }}
    >
      {isEmpty && <DashboardThumbnailEmpty />}
      {canRenderScaled && (
        <ScaledFrame
          innerHeight={innerHeight}
          scale={scale}
          hidden={showSkeleton}
          width={INNER_WIDTH_PX}
        >
          <DashboardRenderer dashboard={dashboard} experimentId={experimentId} />
        </ScaledFrame>
      )}
      {showSkeletonOverlay && (
        <DashboardLayoutSkeleton
          dashboard={dashboard}
          innerHeight={innerHeight}
          scale={scale}
          width={INNER_WIDTH_PX}
        />
      )}
      {!isEmpty && (
        <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t to-transparent" />
      )}
    </div>
  );
}

function computeInnerHeight(dashboard: ExperimentDashboard): number {
  const { rowHeight, gap } = dashboard.layout;
  let maxBottom = 0;
  for (const widget of dashboard.widgets) {
    const bottom = widget.layout.row + widget.layout.rowSpan;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  }
  if (maxBottom === 0) {
    return rowHeight * FALLBACK_ROW_COUNT + gap * (FALLBACK_ROW_COUNT - 1);
  }
  return maxBottom * rowHeight + Math.max(0, maxBottom - 1) * gap;
}
