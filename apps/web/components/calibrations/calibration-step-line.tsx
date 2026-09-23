"use client";

import { InsetPanel } from "@/components/shared/inset-panel";
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

  function renderRowActions() {
    return (
      <>
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
      </>
    );
  }

  function renderMaySkip() {
    return (
      <button
        type="button"
        onClick={toggleOptional}
        disabled={!canEdit}
        className={cn(
          "text-muted-foreground text-xs",
          canEdit && "hover:text-foreground underline decoration-dotted underline-offset-4",
        )}
      >
        {t("iot.calibration.procedure.maySkip")}
      </button>
    );
  }

  const isMarkedOptional = isSkippable && isOptional;
  const canMarkOptional = isSkippable && !isOptional && canEdit;

  return (
    <li className="group relative flex items-baseline gap-3 py-1.5">
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
          {isMarkedOptional && <span className="ml-2">{renderMaySkip()}</span>}
        </p>

        {/* Drawn off the step rather than written into it, so it sits in a well
            instead of floating unframed on the card. */}
        {ramp !== null && (
          <InsetPanel padding="sm" className="max-w-md">
            <CalibrationSetpointShape values={ramp.values} unit={ramp.unit} />
          </InsetPanel>
        )}
      </div>

      {/* Floats over the row rather than taking a column of it: reserving the width
          would rewrap every sentence for controls that are hidden most of the time. */}
      {canEdit && (
        <span className="bg-card text-muted-foreground shadow-xs pointer-events-none absolute right-0 top-1.5 flex h-7 items-center gap-1.5 rounded-md border px-1.5 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          {canMarkOptional && renderMaySkip()}
          {renderRowActions()}
        </span>
      )}
    </li>
  );
}
