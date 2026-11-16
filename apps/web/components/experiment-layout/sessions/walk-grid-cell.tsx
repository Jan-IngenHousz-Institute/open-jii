import type { KeyboardEvent, Ref } from "react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { PlotStateCell } from "../plot-state-cell";
import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";

/** Painting plots into a share, by pointer stroke or by keyboard. */
export interface WalkPaint {
  stroke: readonly string[];
  onStrokeStart: (unitId: string) => void;
  onStrokeEnter: (unitId: string) => void;
  onStrokeEnd: () => void;
  onPaintPlot: (unitId: string) => void;
}

interface WalkGridCellProps {
  unit: ExperimentUnit | undefined;
  plan: FieldPlan;
  showsOrder: boolean;
  shares?: FieldShares;
  isFlagged: boolean;
  /** Outside the stretch of the walk being shown, so drawn without its fill. */
  isFaded?: boolean;
  /** The walk is drawn over the grid, so the plot's text is raised above the line. */
  hasOverlay?: boolean;
  paint?: WalkPaint;
  cellRef?: Ref<HTMLButtonElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/** One position of the Walking order view's grid: balance value, share, and place in the walk. */
export function WalkGridCell({
  unit,
  plan,
  showsOrder,
  shares,
  isFlagged,
  isFaded = false,
  hasOverlay = false,
  paint,
  cellRef,
  onKeyDown,
}: WalkGridCellProps) {
  const { t } = useTranslation("fieldSessions");

  if (!unit?.active) {
    return <PlotStateCell kind="gap" />;
  }

  const position = showsOrder ? plan.positionOf(unit.id) : undefined;
  const isStart = position === 1;
  const isEnd = position !== undefined && position === plan.order.length;
  const tag = isStart ? t("walkingOrder.start") : isEnd ? t("walkingOrder.end") : null;
  const category = isFaded ? undefined : plan.categories.get(plan.balanceValueOf(unit.id));

  const label =
    position === undefined ? undefined : (
      <span className="flex flex-col items-center leading-none">
        <span className={cn("text-[13px] font-semibold", isFaded && "text-muted-foreground/80")}>
          {position}
        </span>
        <span
          className={cn(
            "mt-0.5 text-[10px] font-normal",
            isFaded ? "text-muted-foreground/70" : "text-muted-foreground",
          )}
        >
          {unit.identifier}
        </span>
      </span>
    );

  const cell = (
    <div
      className={cn(
        "relative h-full w-full rounded-md",
        isFlagged && "ring-status-stale-foreground ring-2 ring-offset-1",
      )}
    >
      <PlotStateCell
        kind="plot"
        identifier={unit.identifier}
        category={category}
        share={shares?.styleOfPlot(unit.id)}
        isSelected={paint?.stroke.includes(unit.id) ?? false}
        hasOverlay={hasOverlay}
        label={label}
      />
      {tag ? (
        <span className="bg-foreground text-background z-2 absolute left-1 top-1 rounded px-1 text-[9px] font-semibold leading-tight">
          {tag}
        </span>
      ) : null}
    </div>
  );

  if (paint === undefined) {
    return cell;
  }

  const handlePointerDown = () => {
    paint.onStrokeStart(unit.id);
  };

  const handlePointerEnter = () => {
    paint.onStrokeEnter(unit.id);
  };

  return (
    <button
      ref={cellRef}
      type="button"
      title={unit.identifier}
      aria-label={unit.identifier}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onKeyDown={onKeyDown}
      className="focus-visible:ring-ring h-full w-full cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2"
    >
      {cell}
    </button>
  );
}
