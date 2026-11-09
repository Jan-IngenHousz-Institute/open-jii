import type { DayState } from "@repo/monitoring/status-document";

// Opaque mixes with the card, so tilted bars keep their colour where they overlap. The levels keep
// every state at 3:1 or more against the card and apart from the others under normal vision and
// red-green and blue-yellow colour blindness, which is why light and dark use different strengths.
export const CELL: Record<DayState, string> = {
  operational:
    "bg-[color-mix(in_srgb,var(--status-active-foreground)_70%,var(--card))] dark:bg-status-active-foreground",
  degraded:
    "bg-status-stale-foreground dark:bg-[color-mix(in_srgb,var(--status-stale-foreground)_80%,var(--card))]",
  outage: "bg-[color-mix(in_srgb,var(--destructive)_80%,var(--card))]",
  maintenance:
    "bg-status-published-foreground dark:bg-[color-mix(in_srgb,var(--status-published-foreground)_60%,var(--card))]",
  none: "border border-[color-mix(in_srgb,var(--muted-foreground)_80%,var(--card))]",
};

export const HISTORY_LEGEND: DayState[] = [
  "operational",
  "degraded",
  "outage",
  "maintenance",
  "none",
];
