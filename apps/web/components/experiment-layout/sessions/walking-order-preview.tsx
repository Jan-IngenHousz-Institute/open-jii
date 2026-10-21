"use client";

import { TriangleAlert } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";

import { PlotStateLegend } from "../plot-state-legend";
import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { OrderCodeLine } from "./order-code-line";
import { SessionGrid } from "./session-grid";
import { useGridFocus } from "./use-grid-focus";
import type { WalkPaint } from "./walk-grid-cell";
import { WalkGridCell } from "./walk-grid-cell";
import { WalkStrip } from "./walk-strip";

interface WalkingOrderPreviewProps {
  plan: FieldPlan;
  /** Numbers the plots, marks Start and End and lays the walk out under the grid. */
  showsOrder: boolean;
  canEdit: boolean;
  onRegenerate: () => void;
  shares?: FieldShares;
  paint?: WalkPaint;
}

const PAINT_KEYS = new Set([" ", "Enter"]);

/** The Walking order view's grid, with the walk and any shares drawn on the plots. */
export function WalkingOrderPreview({
  plan,
  showsOrder,
  canEdit,
  onRegenerate,
  shares,
  paint,
}: WalkingOrderPreviewProps) {
  const { t } = useTranslation("fieldSessions");
  const [isPathShown, setIsPathShown] = useState(false);
  const focus = useGridFocus(plan.layout.rows, plan.layout.columns);

  const balance = plan.balance();
  const isOutside = balance.outside !== null;
  const hasOrderCode = showsOrder && plan.isRandom && plan.orderCode !== null;
  const flagged = new Set(
    balance.outside === null
      ? []
      : plan.order.slice(balance.outside.first - 1, balance.outside.last),
  );

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
      paint={paint}
      cellRef={focus.register(row, column)}
      onKeyDown={unit === undefined ? undefined : handleKey(unit, row, column)}
    />
  );

  const path = (
    <polyline
      points={plan
        .walkPoints()
        .map(({ x, y }) => `${x},${y}`)
        .join(" ")}
      fill="none"
      className="stroke-foreground/70"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );

  const pathSwitch = (
    <div className="flex items-center gap-2">
      <Label htmlFor="walk-show-path" className="text-sm font-normal">
        {t("walkingOrder.showPath")}
      </Label>
      <Switch id="walk-show-path" checked={isPathShown} onCheckedChange={setIsPathShown} />
    </div>
  );

  const balanceLine = isOutside ? (
    <p className="text-status-stale-foreground flex items-center gap-1.5 text-sm">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      {t("walkingOrder.unbalanced", { first: balance.outside?.first, last: balance.outside?.last })}
    </p>
  ) : (
    <p className="text-sm">
      {t("walkingOrder.balance", { window: balance.window, expected: balance.expected })}
    </p>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gridTitle", { level: plan.layout.levelName })}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {showsOrder ? <CardAction>{pathSwitch}</CardAction> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <SessionGrid
          layout={plan.layout}
          renderCell={renderCell}
          overlay={showsOrder && isPathShown ? path : undefined}
          onPointerUp={paint?.onStrokeEnd}
        />

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
            categoryName={t("treatment")}
            categories={plan.categories}
            shares={shares?.legend}
            entries={["gap"]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
