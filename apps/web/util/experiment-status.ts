import type { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";

/**
 * Badge color class per experiment status.
 *
 * A total `Record` rather than the `switch` its two siblings use, and deliberately so:
 * the badge tokens happen to be named after the four statuses, so the mapping is 1:1
 * and there is no honest default to fall through to. A fifth status must be given a
 * colour rather than silently inheriting one — a `Record` fails to compile until it is,
 * where a `switch` with a `default` would not.
 *
 * Keyed by the union, so this takes a typed status rather than a raw string; the
 * showcase's rows carry it typed off the discriminated contract shape.
 */
const STATUS_BADGE_COLORS: Record<ExperimentStatus, string> = {
  active: "bg-badge-active",
  stale: "bg-badge-stale",
  archived: "bg-badge-archived",
  published: "bg-badge-published",
};

/**
 * The pale `badge-*` fills are designed to sit under the Badge component's default
 * `text-black`, so consumers pass this as the only class and leave the variant alone.
 */
export function getExperimentStatusBadgeColor(status: ExperimentStatus): string {
  return STATUS_BADGE_COLORS[status];
}
