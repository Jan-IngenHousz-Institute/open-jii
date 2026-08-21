import type { StatusTone } from "@/components/shared/status-badge";

import type { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";

/**
 * Badge tone per experiment status.
 *
 * A total `Record` rather than the `switch` its two siblings use, and deliberately so:
 * the tones happen to be named after the four statuses, so the mapping is 1:1
 * and there is no honest default to fall through to. A fifth status must be given a
 * tone rather than silently inheriting one — a `Record` fails to compile until it is,
 * where a `switch` with a `default` would not.
 *
 * Keyed by the union, so this takes a typed status rather than a raw string; the
 * showcase's rows carry it typed off the discriminated contract shape.
 */
const STATUS_BADGE_TONES: Record<ExperimentStatus, StatusTone> = {
  active: "active",
  stale: "stale",
  archived: "archived",
  published: "published",
};

/**
 * Fill and foreground travel together in `StatusBadge`, so consumers hand it a
 * tone rather than a colour class.
 */
export function getExperimentStatusBadgeTone(status: ExperimentStatus): StatusTone {
  return STATUS_BADGE_TONES[status];
}
