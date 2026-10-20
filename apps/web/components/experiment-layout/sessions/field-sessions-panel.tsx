"use client";

import { useExperimentLayout } from "@/hooks/experiment/useExperimentLayout/useExperimentLayout";
import { useExperimentSessionWalkingOrder } from "@/hooks/experiment/useExperimentSessionWalkingOrder/useExperimentSessionWalkingOrder";
import type { ReactNode } from "react";

import { Skeleton } from "@repo/ui/components/skeleton";

import { DivideFieldSection } from "./divide-field-section";
import { FieldPlan } from "./field-plan";
import { LiveProgressSection } from "./live-progress-section";
import { NeedsReviewSection } from "./needs-review-section";
import { SessionOverviewSection } from "./session-overview-section";
import type { SessionsView, SessionsViewProps } from "./sessions-view";
import { WalkingOrderSection } from "./walking-order-section";

interface FieldSessionsPanelProps {
  experimentId: string;
  canEdit: boolean;
  view: SessionsView;
}

const VIEWS: Record<SessionsView, (props: SessionsViewProps) => ReactNode> = {
  "walking-order": (props) => <WalkingOrderSection {...props} isPreviewing={false} />,
  "order-preview": (props) => <WalkingOrderSection {...props} isPreviewing />,
  divide: (props) => <DivideFieldSection {...props} />,
  live: (props) => <LiveProgressSection {...props} />,
  overview: (props) => <SessionOverviewSection {...props} />,
  review: (props) => <NeedsReviewSection {...props} />,
};

export function FieldSessionsPanel({ experimentId, canEdit, view }: FieldSessionsPanelProps) {
  const { data: layout, isLoading: isLayoutLoading } = useExperimentLayout(experimentId);
  const { data: walkingOrder, isLoading: isOrderLoading } =
    useExperimentSessionWalkingOrder(experimentId);

  if (isLayoutLoading || isOrderLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!layout || !walkingOrder) {
    return null;
  }

  const plan = new FieldPlan(layout, walkingOrder);
  return VIEWS[view]({ experimentId, canEdit, plan });
}
