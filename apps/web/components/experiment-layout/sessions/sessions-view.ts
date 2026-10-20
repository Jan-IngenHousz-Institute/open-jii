import type { FieldPlan } from "./field-plan";

export const SESSIONS_VIEWS = [
  "walking-order",
  "order-preview",
  "divide",
  "live",
  "overview",
  "review",
] as const;

export type SessionsView = (typeof SESSIONS_VIEWS)[number];

export interface SessionsViewProps {
  experimentId: string;
  canEdit: boolean;
  plan: FieldPlan;
}
