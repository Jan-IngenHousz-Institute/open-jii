import { useExperimentStandardsFields } from "~/hooks/experiment/useExperimentStandardsFields/useExperimentStandardsFields";
import { useExperimentStandardsReadiness } from "~/hooks/experiment/useExperimentStandardsReadiness/useExperimentStandardsReadiness";

import type {
  FieldFix,
  StandardFields,
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";

export type ReadinessAction = FieldFix | "add-terms" | "publish-dataset";

/** One thing a researcher does, and every standard it moves. */
export interface ReadinessStep {
  action: ReadinessAction;
  /** The authors, columns or fields the step acts on, for its title. */
  subjects: number;
  /** The standard fields the step fills across every standard it moves. */
  fields: number;
  standards: StandardId[];
}

export interface ReadinessOverview {
  standards: StandardReadiness[];
  steps: ReadinessStep[];
}

const PUBLISH_LAST = "publish-dataset";

/**
 * Groups what each standard lacks by the action that fills it, so one action that moves several
 * standards appears once. Publishing comes last because every other step feeds into it.
 */
export function readinessSteps(
  readiness: StandardReadiness[],
  miappe: StandardFields | undefined,
): ReadinessStep[] {
  const steps = new Map<ReadinessAction, ReadinessStep>();

  const add = (action: ReadinessAction, subjects: number, fields: number, standard: StandardId) => {
    const step = steps.get(action) ?? { action, subjects, fields: 0, standards: [] };
    step.fields += fields;
    step.subjects = Math.max(step.subjects, subjects);
    if (!step.standards.includes(standard)) {
      step.standards.push(standard);
    }
    steps.set(action, step);
  };

  for (const field of miappe?.fields ?? []) {
    if (field.status === "missing") {
      const subjects = "count" in field.reason ? field.reason.count : 1;
      add(field.fix, subjects, 1, "miappe");
    }
  }

  for (const row of readiness) {
    if (row.reason.code === "columns-without-term") {
      add("add-terms", row.reason.count, row.reason.count, row.standard);
    }
    if (row.reason.code === "fields-from-dataset" || row.reason.code === "no-published-dataset") {
      add(PUBLISH_LAST, 1, row.reason.code === "fields-from-dataset" ? row.reason.count : 0, row.standard);
    }
  }

  return [...steps.values()].sort((a, b) => {
    if (a.action === PUBLISH_LAST) {
      return 1;
    }
    if (b.action === PUBLISH_LAST) {
      return -1;
    }
    return b.standards.length - a.standards.length || b.fields - a.fields;
  });
}

/** The readiness rows and the steps that would close them, once both answers are in. */
export function useReadinessOverview(experimentId: string): ReadinessOverview | undefined {
  const { data: readiness } = useExperimentStandardsReadiness(experimentId);
  const { data: miappe } = useExperimentStandardsFields(experimentId, "miappe");

  if (!readiness || !miappe) {
    return undefined;
  }

  return { standards: readiness.standards, steps: readinessSteps(readiness.standards, miappe) };
}
