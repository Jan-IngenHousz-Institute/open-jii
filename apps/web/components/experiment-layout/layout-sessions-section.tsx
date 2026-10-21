"use client";

import { useExperimentLayout } from "@/hooks/experiment/useExperimentLayout/useExperimentLayout";
import { useExperimentSessionWalkingOrder } from "@/hooks/experiment/useExperimentSessionWalkingOrder/useExperimentSessionWalkingOrder";
import { useSearchParams } from "next/navigation";

import { Skeleton } from "@repo/ui/components/skeleton";

import { isLayoutView, LAYOUT_VIEW_PARAM } from "./layout-view";
import { FieldDaysView } from "./sessions/field-days-view";
import { FieldPlan } from "./sessions/field-plan";
import { LoadFailed } from "./sessions/load-failed";
import { isFieldDaysStage, isWalkingOrderStage } from "./sessions/sessions-view";
import { WalkingOrderView } from "./sessions/walking-order-view";

interface LayoutSessionsSectionProps {
  experimentId: string;
  canEdit: boolean;
}

/** The Walking order and Field days views, whichever the address names. */
export function LayoutSessionsSection({ experimentId, canEdit }: LayoutSessionsSectionProps) {
  const searchParams = useSearchParams();
  const layout = useExperimentLayout(experimentId);
  const walkingOrder = useExperimentSessionWalkingOrder(experimentId);

  const requestedView = searchParams.get(LAYOUT_VIEW_PARAM);
  const stage = searchParams.get("sessions");
  const isFieldDays = isLayoutView(requestedView)
    ? requestedView === "field-days"
    : isFieldDaysStage(stage);

  const retry = () => {
    void layout.refetch();
    void walkingOrder.refetch();
  };

  if (layout.isLoading || walkingOrder.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!layout.data || !walkingOrder.data) {
    return <LoadFailed onRetry={retry} />;
  }

  const plan = new FieldPlan(layout.data, walkingOrder.data);

  if (isFieldDays) {
    return (
      <FieldDaysView
        experimentId={experimentId}
        canEdit={canEdit}
        plan={plan}
        stage={isFieldDaysStage(stage) ? stage : "overview"}
      />
    );
  }

  return (
    <WalkingOrderView
      experimentId={experimentId}
      canEdit={canEdit}
      plan={plan}
      stage={isWalkingOrderStage(stage) ? stage : "order-preview"}
    />
  );
}
