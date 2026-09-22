"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { CalibrationSetpointShape } from "./calibration-setpoint-shape";
import { CalibrationStepSentence } from "./calibration-step-sentence";
import type { ReadSource, SetpointTarget } from "./rig-sources";
import { stepAppearance } from "./step-appearance";

interface CalibrationStepLineProps {
  step: ProcedureStep;
  index: number;
  count: number;
  sources: ReadSource[];
  targets: SetpointTarget[];
  takenSeries: string[];
  canEdit: boolean;
  onChange: (step: ProcedureStep) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/**
 * One numbered instruction in the procedure.
 *
 * The gutter carries the ordinal and one monochrome glyph. Kind is already in the sentence's
 * first word, so spending colour on it costs the page its calm and says nothing twice.
 */
export function CalibrationStepLine({
  step,
  index,
  count,
  sources,
  targets,
  takenSeries,
  canEdit,
  onChange,
  onMove,
  onRemove,
}: CalibrationStepLineProps) {
  const { t } = useTranslation("iot");

  const { icon: Icon } = stepAppearance(step.kind);
  const isSkippable = step.kind === "read" || step.kind === "sweep";
  const isOptional = isSkippable && step.optional === true;

  // Whether a ramp is even or crowds one end decides what the fit can see, and a list of
  // numbers in a sentence hides that as completely as a column of them did.
  const stimulus = step.kind === "sweep" ? step.stimulus : undefined;
  const driven = stimulus !== undefined && "instrument" in stimulus ? stimulus : undefined;
  const ramp =
    driven === undefined
      ? null
      : {
          values: driven.values,
          unit: targets
            .find((target) => target.role === driven.instrument)
            ?.setpoints.find((setpoint) => setpoint.name === driven.set)?.unit,
        };

  function toggleOptional() {
    if (isSkippable) {
      onChange({ ...step, optional: isOptional ? undefined : true });
    }
  }

  function renderRowActions() {
    return (
      <span className="text-muted-foreground/0 group-hover:text-muted-foreground/70 focus-within:text-muted-foreground/70 ml-1 whitespace-nowrap transition-colors">
        <button
          type="button"
          onClick={() => onMove(index - 1)}
          disabled={index === 0}
          aria-label={t("iot.calibration.procedure.moveUp", { position: index + 1 })}
          className="hover:text-foreground px-0.5 align-middle disabled:opacity-30"
        >
          <ArrowUp className="inline size-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMove(index + 1)}
          disabled={index === count - 1}
          aria-label={t("iot.calibration.procedure.moveDown", { position: index + 1 })}
          className="hover:text-foreground px-0.5 align-middle disabled:opacity-30"
        >
          <ArrowDown className="inline size-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("iot.calibration.procedure.removeStep", { position: index + 1 })}
          className="hover:text-destructive px-0.5 align-middle"
        >
          <X className="inline size-3" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <li className="group py-1.5">
      <div className="flex gap-3">
        <span className="text-muted-foreground flex shrink-0 select-none items-baseline gap-1.5 pt-0.5 text-xs tabular-nums">
          <span className="w-4 text-right">{index + 1}</span>
          <Icon className="size-3.5 translate-y-0.5" aria-hidden />
        </span>

        <p className={cn("text-[15px] leading-7", isOptional && "text-muted-foreground")}>
          <CalibrationStepSentence
            step={step}
            sources={sources}
            targets={targets}
            takenSeries={takenSeries}
            canEdit={canEdit}
            onChange={onChange}
          />

          {isSkippable && (isOptional || canEdit) && (
            <button
              type="button"
              onClick={toggleOptional}
              disabled={!canEdit}
              className={cn(
                "text-muted-foreground ml-2 align-middle text-xs",
                canEdit && "hover:text-foreground underline decoration-dotted underline-offset-4",
                !isOptional && "opacity-0 focus:opacity-100 group-hover:opacity-100",
              )}
            >
              {t("iot.calibration.procedure.maySkip")}
            </button>
          )}

          {canEdit && renderRowActions()}
        </p>
      </div>

      {ramp !== null && (
        <div className="max-w-md pl-10">
          <CalibrationSetpointShape values={ramp.values} unit={ramp.unit} />
        </div>
      )}
    </li>
  );
}
