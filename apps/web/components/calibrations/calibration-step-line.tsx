"use client";

import { InsetPanel } from "@/components/shared/inset-panel";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { CalibrationSetpointShape } from "./calibration-setpoint-shape";
import { CalibrationStepActions } from "./calibration-step-actions";
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
  // numbers in a sentence hides it.
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

  // Given a starting instruction to rewrite, since a blank one would read as a finished step.
  function askFirst() {
    if (step.kind === "read") {
      onChange({ ...step, prompt: t("iot.calibration.procedure.readPromptDefault") });
    }
  }

  const canAskFirst = step.kind === "read" && step.prompt === undefined;

  return (
    <li className="group flex items-baseline gap-3 py-1.5">
      <span className="text-muted-foreground flex shrink-0 select-none items-baseline gap-1.5 text-xs tabular-nums">
        <span className="w-4 text-right">{index + 1}</span>
        <Icon className="size-3.5 translate-y-0.5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <p className={cn("text-[15px] leading-7", isOptional && "text-muted-foreground")}>
          <CalibrationStepSentence
            step={step}
            sources={sources}
            targets={targets}
            takenSeries={takenSeries}
            canEdit={canEdit}
            onChange={onChange}
          />
          {/* Once set it is a fact about the step, so it reads in the sentence, not in a menu. */}
          {isOptional && (
            <button
              type="button"
              onClick={toggleOptional}
              disabled={!canEdit}
              className={cn(
                "text-muted-foreground ml-2 text-xs",
                canEdit && "hover:text-foreground underline decoration-dotted underline-offset-4",
              )}
            >
              {t("iot.calibration.procedure.maySkip")}
            </button>
          )}
        </p>

        {/* Drawn off the step rather than written into it, so it sits in a well
            instead of floating unframed on the card. */}
        {ramp !== null && (
          <InsetPanel padding="sm" className="max-w-md">
            <CalibrationSetpointShape values={ramp.values} unit={ramp.unit} />
          </InsetPanel>
        )}
      </div>

      {canEdit && (
        <CalibrationStepActions
          position={index + 1}
          canMoveUp={index > 0}
          canMoveDown={index < count - 1}
          isSkippable={isSkippable}
          isOptional={isOptional}
          canAskFirst={canAskFirst}
          onMoveUp={() => onMove(index - 1)}
          onMoveDown={() => onMove(index + 1)}
          onToggleOptional={toggleOptional}
          onAskFirst={askFirst}
          onRemove={onRemove}
        />
      )}
    </li>
  );
}
