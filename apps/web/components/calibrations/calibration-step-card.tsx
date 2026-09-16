"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useId } from "react";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";

import { CalibrationNumberField } from "./calibration-number-field";
import { CalibrationOperatorStep } from "./calibration-operator-step";
import { CalibrationReadStep } from "./calibration-read-step";
import { CalibrationSetStep } from "./calibration-set-step";
import { CalibrationSweepStep } from "./calibration-sweep-step";
import type { ReadSource, SetpointTarget } from "./rig-sources";

interface CalibrationStepCardProps {
  step: ProcedureStep;
  index: number;
  count: number;
  sources: ReadSource[];
  targets: SetpointTarget[];
  /** Series this phase produces, this step's included, so a rename cannot collide. */
  takenSeries: string[];
  canEdit: boolean;
  onChange: (step: ProcedureStep) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/**
 * One step of a procedure, in the order the bench will run it.
 *
 * Order is the procedure: a settle before a read is the difference between a sensor that
 * has caught up with the light and one that has not.
 */
export function CalibrationStepCard({
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
}: CalibrationStepCardProps) {
  const { t } = useTranslation("iot");
  const optionalId = useId();

  const isSkippable = step.kind === "read" || step.kind === "sweep";

  function renderBody() {
    switch (step.kind) {
      case "operator":
        return <CalibrationOperatorStep step={step} canEdit={canEdit} onChange={onChange} />;
      case "settle":
        return (
          <CalibrationNumberField
            label={t("iot.calibration.procedure.waitFor")}
            value={step.ms}
            onCommit={(ms) => onChange({ ...step, ms: ms ?? step.ms })}
            canEdit={canEdit}
            min={1}
            max={600_000}
            integer
            className="min-w-32 max-w-xs space-y-1"
          />
        );
      case "set":
        return (
          <CalibrationSetStep step={step} targets={targets} canEdit={canEdit} onChange={onChange} />
        );
      case "read":
        return (
          <CalibrationReadStep
            step={step}
            sources={sources}
            takenSeries={takenSeries}
            canEdit={canEdit}
            onChange={onChange}
          />
        );
      case "sweep":
        return (
          <CalibrationSweepStep
            step={step}
            sources={sources}
            targets={targets}
            takenSeries={takenSeries}
            canEdit={canEdit}
            onChange={onChange}
          />
        );
    }
  }

  function renderOptionalToggle() {
    if (!isSkippable) {
      return null;
    }

    return (
      <div className="flex items-center gap-2">
        <Switch
          id={optionalId}
          checked={step.optional === true}
          onCheckedChange={(optional) => onChange({ ...step, optional: optional || undefined })}
          disabled={!canEdit}
        />
        <Label htmlFor={optionalId} className="text-muted-foreground text-xs">
          {t("iot.calibration.procedure.optional")}
        </Label>
      </div>
    );
  }

  return (
    <li className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs">{index + 1}</span>
        <Badge variant="outline" className="font-mono text-[10px] uppercase">
          {step.kind}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          {renderOptionalToggle()}
          {canEdit && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onMove(index - 1)}
                disabled={index === 0}
                aria-label={t("iot.calibration.procedure.moveUp", { position: index + 1 })}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onMove(index + 1)}
                disabled={index === count - 1}
                aria-label={t("iot.calibration.procedure.moveDown", { position: index + 1 })}
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                aria-label={t("iot.calibration.procedure.removeStep", { position: index + 1 })}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </>
          )}
        </div>
      </div>

      {renderBody()}
    </li>
  );
}
