"use client";

import { CellWrapper } from "@/components/workbook/cell-wrapper";
import { ArrowDown, ArrowUp } from "lucide-react";
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
import { stepAppearance, stepLabel } from "./step-appearance";

interface CalibrationStepCellProps {
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
 * One step of a procedure, as a cell of the same kind a workbook is written in.
 *
 * A procedure is an executable document, which this platform already knows how to draw:
 * an identity colour and icon per kind, a line that says what the step does while it is
 * closed, and the run, collapse and delete affordances in the places they live everywhere
 * else. What is inside the cell is the only part particular to calibration.
 */
export function CalibrationStepCell({
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
}: CalibrationStepCellProps) {
  const { t } = useTranslation("iot");
  const optionalId = useId();

  const { icon: Icon, accent } = stepAppearance(step.kind);
  const isSkippable = step.kind === "read" || step.kind === "sweep";
  const isOptional = isSkippable && step.optional === true;

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
    // The header badge says the same thing to a reader, without a switch they cannot throw.
    if (!isSkippable || !canEdit) {
      return null;
    }

    return (
      <div className="flex items-center gap-2 pt-1">
        <Switch
          id={optionalId}
          checked={isOptional}
          onCheckedChange={(optional) => onChange({ ...step, optional: optional || undefined })}
          disabled={!canEdit}
        />
        <Label htmlFor={optionalId} className="text-muted-foreground text-xs">
          {t("iot.calibration.procedure.optionalHint")}
        </Label>
      </div>
    );
  }

  const headerActions = (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 w-7 p-0"
        onClick={() => onMove(index - 1)}
        disabled={index === 0}
        aria-label={t("iot.calibration.procedure.moveUp", { position: index + 1 })}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 w-7 p-0"
        onClick={() => onMove(index + 1)}
        disabled={index === count - 1}
        aria-label={t("iot.calibration.procedure.moveDown", { position: index + 1 })}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
    </>
  );

  return (
    <CellWrapper
      icon={<Icon className="h-4 w-4" />}
      label={<span data-testid="step-label">{stepLabel(step, t)}</span>}
      labelText={stepLabel(step, t)}
      accentColor={accent}
      onDelete={canEdit ? onRemove : undefined}
      deleteLabel={t("iot.calibration.procedure.removeStep", { position: index + 1 })}
      collapseLabel={t("iot.calibration.procedure.collapseStep", { position: index + 1 })}
      expandLabel={t("iot.calibration.procedure.expandStep", { position: index + 1 })}
      headerActions={headerActions}
      headerBadges={
        isOptional ? (
          <Badge variant="secondary" className="text-[10px]">
            {t("iot.calibration.procedure.optional")}
          </Badge>
        ) : undefined
      }
      readOnly={!canEdit}
      // A closed procedure is read, not filled in: it opens as the list of what it does,
      // and a step is unfolded when someone wants that step's detail.
      isCollapsed={!canEdit}
      className="border"
    >
      <div className="space-y-3 px-4 py-3">
        {renderBody()}
        {renderOptionalToggle()}
      </div>
    </CellWrapper>
  );
}
