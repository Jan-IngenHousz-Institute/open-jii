import type {
  CaptureProcedure,
  ProcedureStep,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { SWEEP_STIMULUS_COLUMN } from "@repo/iot";

import type { ProcedurePhase } from "./procedure-edits";
import { phaseSteps, stepReads } from "./procedure-edits";

/** One table the fit receives, as `inputs[name]`. */
export interface ProducedSeries {
  name: string;
  columns: string[];
  /** A step that may not run leaves its series out of the payload entirely. */
  optional: boolean;
}

function producedBy(step: ProcedureStep): ProducedSeries | null {
  if (step.kind !== "read" && step.kind !== "sweep") {
    return null;
  }

  // A sweep writes the setpoint it drove beside the readings taken at it.
  const columns =
    step.kind === "sweep"
      ? [SWEEP_STIMULUS_COLUMN, ...stepReads(step).map((read) => read.as)]
      : stepReads(step).map((read) => read.as);

  return { name: step.series, columns, optional: step.optional ?? false };
}

/**
 * What a phase hands the fit: the series its steps record, and the columns inside each.
 *
 * These are the names the script has to spell exactly, so showing them is the difference
 * between a typo caught while writing and a run that fails at the bench. Two steps may
 * write the same series, in which case the payload carries both sets of columns.
 */
export function producedSeries(
  procedure: CaptureProcedure,
  phase: ProcedurePhase,
): ProducedSeries[] {
  const byName = new Map<string, ProducedSeries>();

  for (const step of phaseSteps(procedure, phase)) {
    const produced = producedBy(step);
    if (produced === null) {
      continue;
    }

    const existing = byName.get(produced.name);
    if (existing === undefined) {
      byName.set(produced.name, produced);
      continue;
    }

    byName.set(produced.name, {
      name: produced.name,
      columns: [...new Set([...existing.columns, ...produced.columns])],
      // Recorded by one step that always runs is enough for the series to arrive.
      optional: existing.optional && produced.optional,
    });
  }

  return [...byName.values()];
}
