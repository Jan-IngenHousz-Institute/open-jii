import { EndedDay } from "./ended-day";
import type { FieldPlan } from "./field-plan";
import { LiveDay } from "./live-day";
import { MeasuredTwiceSection } from "./measured-twice-section";
import type { FieldDaysStage } from "./sessions-view";

interface FieldDaysViewProps {
  experimentId: string;
  canEdit: boolean;
  plan: FieldPlan;
  stage: FieldDaysStage;
}

/**
 * The Layout tab's Field days view: live progress while sessions run, the overview of a chosen
 * day once they end, and the plots measured twice beside the grid.
 */
export function FieldDaysView({ experimentId, canEdit, plan, stage }: FieldDaysViewProps) {
  if (stage === "live") {
    return <LiveDay experimentId={experimentId} plan={plan} />;
  }

  if (stage === "review") {
    return <MeasuredTwiceSection experimentId={experimentId} canEdit={canEdit} plan={plan} />;
  }

  return <EndedDay experimentId={experimentId} canEdit={canEdit} plan={plan} />;
}
