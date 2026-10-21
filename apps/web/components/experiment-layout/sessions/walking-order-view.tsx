"use client";

import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { WalkingOrderEmptyState } from "../walking-order-empty-state";
import { DivideFieldSection } from "./divide-field-section";
import type { FieldPlan } from "./field-plan";
import type { WalkingOrderStage } from "./sessions-view";
import { WalkingOrderCard } from "./walking-order-card";
import { WalkingOrderPreview } from "./walking-order-preview";

interface WalkingOrderViewProps {
  experimentId: string;
  canEdit: boolean;
  plan: FieldPlan;
  stage: WalkingOrderStage;
}

/**
 * The Layout tab's Walking order view: the grid with the walk drawn on it, and a side panel with
 * the strategy and, once measurers are picked, the shares.
 */
export function WalkingOrderView({ experimentId, canEdit, plan, stage }: WalkingOrderViewProps) {
  const { t } = useTranslation("fieldSessions");
  const [isChoosing, setIsChoosing] = useState(false);

  const isUnsaved = plan.strategy === null;
  const showsEmptyState = isUnsaved && !isChoosing;
  const showsOrder = stage === "order-preview" && plan.hasOrder;

  const choose = () => {
    setIsChoosing(true);
  };

  // Scaffold: drawing a new order code is not built yet.
  const regenerate = () => undefined;

  if (showsEmptyState) {
    return (
      <WalkingOrderEmptyState
        firstPlot={plan.firstInLayout}
        action={canEdit ? <Button onClick={choose}>{t("walkingOrder.choose")}</Button> : undefined}
      />
    );
  }

  if (stage === "divide") {
    return <DivideFieldSection experimentId={experimentId} canEdit={canEdit} plan={plan} />;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <WalkingOrderPreview
        plan={plan}
        showsOrder={showsOrder}
        canEdit={canEdit}
        onRegenerate={regenerate}
      />
      <WalkingOrderCard plan={plan} canEdit={canEdit} />
    </div>
  );
}
