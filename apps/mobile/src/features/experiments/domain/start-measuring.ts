import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";

export type StartMeasuringVerdict =
  | { ok: true }
  | { ok: false; reason: "archived" }
  | { ok: false; reason: "no-workbook" }
  | { ok: false; reason: "flow-in-progress"; experimentId: string };

/**
 * Whether the detail screen's primary action can open the measurement picker,
 * checked in refusal order: archived outranks everything, a missing workbook
 * version leaves nothing to measure, and a flow already in progress owns the
 * selection. It cannot tell whether the workbook is *readable*; a private
 * workbook behind a public experiment only fails once the picker loads it.
 */
export function canStartMeasuring(
  experiment: Pick<Experiment, "status" | "workbookVersionId">,
  flowExperimentId: string | undefined,
): StartMeasuringVerdict {
  if (experiment.status === "archived") return { ok: false, reason: "archived" };
  if (!experiment.workbookVersionId) return { ok: false, reason: "no-workbook" };
  if (flowExperimentId)
    return { ok: false, reason: "flow-in-progress", experimentId: flowExperimentId };
  return { ok: true };
}
