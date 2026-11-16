"use client";

import { useLocale } from "@/hooks/useLocale";
import { TriangleAlert } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type { WalkingStrategy } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { PlotStateLegend } from "../plot-state-legend";
import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { OrderCodeLine } from "./order-code-line";
import { SessionGrid } from "./session-grid";
import { useGridFocus } from "./use-grid-focus";
import type { WalkPaint } from "./walk-grid-cell";
import { WalkGridCell } from "./walk-grid-cell";
import { WalkPathOverlay } from "./walk-path-overlay";
import { WalkStretchControl } from "./walk-stretch-control";
import { WalkStrip } from "./walk-strip";

interface WalkingOrderPreviewProps {
  plan: FieldPlan;
  /** Numbers the plots, marks Start and End and lays the walk out under the grid. */
  showsOrder: boolean;
  /** Draws the walk on the grid, whole or as a stretch, wherever the order is shown. */
  showsPath: boolean;
  canEdit: boolean;
  onRegenerate: () => void;
  shares?: FieldShares;
  paint?: WalkPaint;
}

const PAINT_KEYS = new Set([" ", "Enter"]);

// These walks never cross themselves, so the whole walk reads as one line. Any other walk drawn
// whole is a tangle, so the preview shows a stretch of it instead.
const WHOLE_WALK_STRATEGIES: readonly (WalkingStrategy | null)[] = ["byRow", "serpentine"];

/** The Walking order view's grid, with the walk and any shares drawn on the plots. */
export function WalkingOrderPreview({
  plan,
  showsOrder,
  showsPath,
  canEdit,
  onRegenerate,
  shares,
  paint,
}: WalkingOrderPreviewProps) {
  const { t } = useTranslation("fieldSessions");
  const locale = useLocale();
  const [stretchFirst, setStretchFirst] = useState(1);
  const focus = useGridFocus(plan.layout.rows, plan.layout.columns);

  const balance = plan.balance();
  const isOutside = balance.outside !== null;
  const hasOrderCode = showsOrder && plan.isRandom && plan.orderCode !== null;
  const flagged = new Set(
    balance.outside === null
      ? []
      : plan.order.slice(balance.outside.first - 1, balance.outside.last),
  );

  const isPathShown = showsOrder && showsPath;
  const isWholeWalk = WHOLE_WALK_STRATEGIES.includes(plan.strategy);
  const isStretchShown = isPathShown && !isWholeWalk;
  const stretch = {
    first: stretchFirst,
    last: Math.min(stretchFirst + balance.window - 1, plan.order.length),
  };
  const stretchOrder = plan.stretchPlots(stretch);
  const stretchPlots = new Set(stretchOrder);
  const pathPlots = isStretchShown ? stretchOrder : plan.order;

  const description = shares
    ? t("divide.gridDescription", { count: plan.plots.length })
    : showsOrder
      ? t("walkingOrder.previewDescription", { count: plan.plots.length })
      : t("plotCount", { count: plan.plots.length });

  const handleKey =
    (unit: ExperimentUnit, row: number, column: number) =>
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (focus.move(row, column, event)) {
        return;
      }
      if (PAINT_KEYS.has(event.key)) {
        event.preventDefault();
        paint?.onPaintPlot(unit.id);
      }
    };

  const renderCell = (unit: ExperimentUnit | undefined, row: number, column: number) => (
    <WalkGridCell
      unit={unit}
      plan={plan}
      showsOrder={showsOrder}
      shares={shares}
      isFlagged={unit !== undefined && showsOrder && flagged.has(unit.id)}
      isFaded={unit !== undefined && isStretchShown && !stretchPlots.has(unit.id)}
      hasOverlay={isPathShown}
      paint={paint}
      cellRef={focus.register(row, column)}
      onKeyDown={unit === undefined ? undefined : handleKey(unit, row, column)}
    />
  );

  const balanceLine = isOutside ? (
    <p className="text-status-stale-foreground flex items-center gap-1.5 text-sm">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      {t("walkingOrder.unbalanced", { first: balance.outside?.first, last: balance.outside?.last })}
    </p>
  ) : (
    <p className="text-sm">
      {t("walkingOrder.balance", {
        window: balance.window,
        values: new Intl.ListFormat(locale).format(plan.balanceValues),
      })}
    </p>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gridTitle", { level: plan.layout.levelName })}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SessionGrid
          layout={plan.layout}
          renderCell={renderCell}
          overlay={
            isPathShown ? <WalkPathOverlay points={plan.walkPoints(pathPlots)} /> : undefined
          }
          onPointerUp={paint?.onStrokeEnd}
        />

        {isStretchShown ? (
          <WalkStretchControl plan={plan} stretch={stretch} onMove={setStretchFirst} />
        ) : null}

        {showsOrder ? (
          <div className="pt-3">
            <WalkStrip plan={plan} outside={balance.outside} shares={shares} />
          </div>
        ) : null}

        <div className="space-y-3 border-t pt-4">
          {showsOrder ? balanceLine : null}
          {hasOrderCode && plan.orderCode ? (
            <OrderCodeLine
              code={plan.orderCode}
              onRegenerate={canEdit ? onRegenerate : undefined}
            />
          ) : null}
          <PlotStateLegend
            categoryName={plan.balanceName ?? undefined}
            categories={plan.categories}
            shares={shares?.legend}
            entries={["gap"]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
