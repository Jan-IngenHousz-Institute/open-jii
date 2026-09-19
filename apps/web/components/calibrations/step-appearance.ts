/**
 * How each kind of step reads at a glance. The colours are the workbook cell tokens, for
 * the same reason they exist there: six categories told apart down a long document.
 */
import { Hand, Microscope, SlidersHorizontal, Timer, TrendingUp } from "lucide-react";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import type { StepKind } from "./procedure-edits";

interface StepAppearance {
  icon: typeof Hand;
  accent: string;
}

const APPEARANCE: Record<StepKind, StepAppearance> = {
  operator: { icon: Hand, accent: "var(--node-instruction)" },
  settle: { icon: Timer, accent: "var(--node-branch)" },
  set: { icon: SlidersHorizontal, accent: "var(--node-command)" },
  read: { icon: Microscope, accent: "var(--node-measurement)" },
  sweep: { icon: TrendingUp, accent: "var(--node-analysis)" },
};

export function stepAppearance(kind: StepKind): StepAppearance {
  return APPEARANCE[kind];
}

/** A step's own summary: what it does, in the words of the thing it drives. */
export function stepLabel(
  step: ProcedureStep,
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  switch (step.kind) {
    case "operator":
      return step.prompt;
    case "settle":
      return t("iot.calibration.procedure.label.settle", { ms: step.ms });
    case "set":
      return t("iot.calibration.procedure.label.set", {
        instrument: step.instrument,
        setpoint: step.set,
        value: step.value,
      });
    case "read":
      return t("iot.calibration.procedure.label.read", { series: step.series });
    case "sweep":
      return "instrument" in step.stimulus
        ? t("iot.calibration.procedure.label.sweepInstrument", {
            instrument: step.stimulus.instrument,
            setpoint: step.stimulus.set,
            points: step.stimulus.values.length,
          })
        : t("iot.calibration.procedure.label.sweepOperator", {
            points: step.stimulus.values.length,
          });
  }
}
