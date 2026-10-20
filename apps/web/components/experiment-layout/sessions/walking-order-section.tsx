import type { SessionsViewProps } from "./sessions-view";
import { WalkingOrderCard } from "./walking-order-card";
import { WalkingOrderPreview } from "./walking-order-preview";

interface WalkingOrderSectionProps extends SessionsViewProps {
  isPreviewing: boolean;
}

export function WalkingOrderSection({ canEdit, plan, isPreviewing }: WalkingOrderSectionProps) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
      {canEdit ? <WalkingOrderCard plan={plan} /> : null}
      <WalkingOrderPreview plan={plan} isPreviewing={isPreviewing} />
    </div>
  );
}
