"use client";

import type {
  CaptureProcedure,
  ProcedureRead,
  ProcedureStep,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

type Phase = "steps" | "verify";

/**
 * A procedure in plain language, beside the JSON that defines it.
 *
 * An author works in the JSON, but a reviewer, or the author an hour later, needs to see
 * what the bench will actually be asked to do without parsing a step grammar by eye.
 */
export function CalibrationProcedureSummary({ procedure }: { procedure: CaptureProcedure }) {
  const { t } = useTranslation("iot");

  function describeRead(read: ProcedureRead): string {
    if ("operator" in read) {
      return t("iot.calibration.detail.readTyped", { as: read.as, prompt: read.operator });
    }
    const source = read.command ?? read.protocol ?? "";
    const repeated = read.repeat === undefined ? "" : ` ×${String(read.repeat)}`;
    return t("iot.calibration.detail.readInstrument", {
      as: read.as,
      instrument: read.instrument,
      source: `${source}${repeated}`,
    });
  }

  function describeStep(step: ProcedureStep): string {
    switch (step.kind) {
      case "operator":
        return step.confirm === undefined
          ? step.prompt
          : t("iot.calibration.detail.gatedBy", { prompt: step.prompt, token: step.confirm });
      case "settle":
        return t("iot.calibration.detail.settle", { ms: step.ms });
      case "set":
        return t("iot.calibration.detail.set", {
          instrument: step.instrument,
          setpoint: step.set,
          value: step.value,
        });
      case "read":
        return t("iot.calibration.detail.read", { series: step.series });
      case "sweep":
        return "instrument" in step.stimulus
          ? t("iot.calibration.detail.sweepInstrument", {
              series: step.series,
              instrument: step.stimulus.instrument,
              setpoint: step.stimulus.set,
              points: step.stimulus.values.length,
            })
          : t("iot.calibration.detail.sweepOperator", {
              series: step.series,
              points: step.stimulus.values.length,
            });
    }
  }

  function renderStep(step: ProcedureStep, index: number) {
    const reads = step.kind === "read" || step.kind === "sweep" ? step.read : [];
    const isOptional = (step.kind === "read" || step.kind === "sweep") && step.optional === true;

    return (
      <li key={`${step.kind}:${String(index)}`} className="space-y-1 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-mono text-xs">{index + 1}</span>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {step.kind}
          </Badge>
          <span className="text-sm">{describeStep(step)}</span>
          {isOptional && (
            <Badge variant="secondary" className="text-[10px]">
              {t("iot.calibration.detail.optional")}
            </Badge>
          )}
        </div>
        {reads.length > 0 && (
          <ul className="text-muted-foreground ml-8 list-disc space-y-0.5 text-xs">
            {reads.map((read) => (
              <li key={read.as}>{describeRead(read)}</li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  function renderPhase(phase: Phase, steps: ProcedureStep[]) {
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {t(`iot.calibration.detail.${phase}`)}
        </p>
        <ol className="divide-y">{steps.map(renderStep)}</ol>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderPhase("steps", procedure.steps)}
      {procedure.verify !== undefined && renderPhase("verify", procedure.verify)}
    </div>
  );
}
