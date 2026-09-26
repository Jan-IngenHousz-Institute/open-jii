import type { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";

// Namespace-qualified: react-i18next pins `t` to the FIRST namespace of an
// array, so a bare `status.x` from a multi-namespace screen renders raw.
// `active` is the unremarkable case and deliberately has no label: a tag on
// every row would carry no information.
const STATUS_LABEL_KEYS = {
  stale: "experiments:status.stale",
  archived: "experiments:status.archived",
  published: "experiments:status.published",
} as const satisfies Partial<Record<ExperimentStatus, string>>;

export function experimentStatusLabelKey(status: ExperimentStatus): string | null {
  return status in STATUS_LABEL_KEYS
    ? STATUS_LABEL_KEYS[status as keyof typeof STATUS_LABEL_KEYS]
    : null;
}
