/** Scaffold: the `sessions` search parameter picks which state of a view a capture shows. */
export const SESSIONS_VIEWS = [
  "walking-order",
  "order-preview",
  "divide",
  "live",
  "overview",
  "review",
] as const;

export type SessionsView = (typeof SESSIONS_VIEWS)[number];

export const WALKING_ORDER_STAGES = ["walking-order", "order-preview", "divide"] as const;

export type WalkingOrderStage = (typeof WALKING_ORDER_STAGES)[number];

export const FIELD_DAYS_STAGES = ["live", "overview", "review"] as const;

export type FieldDaysStage = (typeof FIELD_DAYS_STAGES)[number];

export function isWalkingOrderStage(value: string | null): value is WalkingOrderStage {
  return WALKING_ORDER_STAGES.some((stage) => stage === value);
}

export function isFieldDaysStage(value: string | null): value is FieldDaysStage {
  return FIELD_DAYS_STAGES.some((stage) => stage === value);
}
