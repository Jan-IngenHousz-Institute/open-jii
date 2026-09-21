"use client";

import { stepAppearance, stepLabel } from "@/components/calibrations/step-appearance";
import { InsetPanel } from "@/components/shared/inset-panel";
import type { UnitIdentity } from "@/hooks/iot/useCalibrationCapture/useCalibrationCapture";
import type { RigRole } from "@/hooks/iot/useCalibrationRig/useCalibrationRig";
import type { IotDeviceConnection } from "@/hooks/iot/useIotConnections/useIotConnections";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Check, CircleDashed, Loader2, TriangleAlert } from "lucide-react";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { CalibrationElapsed } from "./calibration-elapsed";

interface CalibrationSessionRailProps {
  family: CalibrationFamily;
  /** Absent until a procedure is chosen; the rail then previews what that procedure needs. */
  procedure: CaptureProcedure | undefined;
  connection: IotDeviceConnection | undefined;
  unit: UnitIdentity | undefined;
  roles: RigRole[];
  /** The step the interpreter is on, or null when nothing is running. */
  activeStep: number | null;
  /** The capture is behind us, so every step reads as run rather than as still to do. */
  isComplete: boolean;
  isRunning: boolean;
}

/** 12px, not 11: this is read at arm's length from a bench, not leaned into. */
const SECTION = "text-muted-foreground text-xs font-medium uppercase tracking-wide";

/**
 * The session as an instrument panel: what is on the ports, what the procedure will do, and
 * where the run has got to.
 *
 * It reads as a preview while a procedure is being chosen and as live status once the run
 * starts, because it is the same three questions either way.
 */
export function CalibrationSessionRail({
  family,
  procedure,
  connection,
  unit,
  roles,
  activeStep,
  isComplete,
  isRunning,
}: CalibrationSessionRailProps) {
  const { t } = useTranslation("iot");

  const steps = procedure?.steps ?? [];

  function renderMark(state: "done" | "active" | "waiting" | "warn") {
    if (state === "active") {
      return <Loader2 className="text-primary size-3.5 shrink-0 animate-spin" aria-hidden />;
    }
    if (state === "done") {
      return <Check className="text-status-active size-3.5 shrink-0" aria-hidden />;
    }
    if (state === "warn") {
      return <TriangleAlert className="text-destructive size-3.5 shrink-0" aria-hidden />;
    }
    return <CircleDashed className="text-muted-foreground size-3.5 shrink-0" aria-hidden />;
  }

  /**
   * What the device row says about the unit answering, in one line rather than an alert.
   * A family that announces nothing says so: the connection's own label is a counter
   * ("Device #1") and reads as an identity check that passed.
   */
  function deviceNote() {
    if (connection === undefined) {
      return t("iot.calibration.rail.deviceWaiting");
    }
    if (unit?.kind === "mismatch") {
      return t("iot.calibration.rail.deviceWrongUnit", { reported: unit.reported });
    }
    if (unit?.kind === "match") {
      return unit.serial;
    }
    return t("iot.calibration.rail.deviceUnnamed");
  }

  function renderDevice() {
    const isWrongUnit = unit?.kind === "mismatch" || connection?.family !== family;
    const state = connection === undefined ? "waiting" : isWrongUnit ? "warn" : "done";

    return (
      <section className="space-y-1.5">
        <p className={SECTION}>{t("iot.calibration.rail.device")}</p>
        <div className="flex items-start gap-2">
          {renderMark(state)}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{getSensorFamilyLabel(family)}</p>
            <p className="text-muted-foreground truncate text-xs">{deviceNote()}</p>
          </div>
        </div>
      </section>
    );
  }

  function renderRole(role: RigRole) {
    const status = role.status;
    const state =
      status.kind === "connected"
        ? "done"
        : status.kind === "connecting"
          ? "active"
          : status.kind === "idle"
            ? "waiting"
            : "warn";
    const detail = status.kind === "connected" ? status.model : role.handshake;

    return (
      <li key={role.role} className="flex items-start gap-2">
        {renderMark(state)}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {role.role}
            {!role.required && (
              <span className="text-muted-foreground ml-1.5 text-xs">
                {t("iot.calibration.rail.optional")}
              </span>
            )}
          </p>
          <p className="text-muted-foreground truncate font-mono text-xs">{detail}</p>
        </div>
      </li>
    );
  }

  function renderBench() {
    if (roles.length === 0) {
      return null;
    }
    return (
      <section className="space-y-1.5">
        <p className={SECTION}>{t("iot.calibration.rail.bench")}</p>
        <ul className="space-y-2">{roles.map(renderRole)}</ul>
      </section>
    );
  }

  // The plan before the run and the position during it, in one list. A step's own words are
  // what the authoring page shows, so the same procedure reads the same in both places.
  function renderStep(step: (typeof steps)[number], index: number) {
    const isActive = activeStep === index;
    const isDone = isComplete || (activeStep !== null && index < activeStep);
    const Glyph = stepAppearance(step.kind).icon;

    return (
      <li
        key={index}
        className="flex items-start gap-2"
        aria-current={isActive ? "step" : undefined}
      >
        <span
          className={cn(
            "w-4 shrink-0 text-right text-xs tabular-nums",
            isActive ? "text-foreground font-medium" : "text-muted-foreground",
          )}
        >
          {index + 1}
        </span>
        {isDone ? (
          <Check className="text-status-active mt-px size-3.5 shrink-0" aria-hidden />
        ) : (
          <Glyph
            className={cn(
              "mt-px size-3.5 shrink-0",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden
          />
        )}
        {/* Clamped: an operator prompt is a sentence or two and it is already on screen in
            full, in the main column, whenever it is the step being answered. */}
        <span
          className={cn(
            "line-clamp-2 min-w-0 flex-1 text-xs",
            isActive ? "text-foreground font-medium" : "text-muted-foreground",
          )}
        >
          {stepLabel(step, t)}
        </span>
      </li>
    );
  }

  function renderSteps() {
    if (steps.length === 0) {
      return (
        <p className="text-muted-foreground text-xs">{t("iot.calibration.rail.noProcedure")}</p>
      );
    }
    return (
      <section className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className={SECTION}>{t("iot.calibration.rail.procedure")}</p>
          {isRunning && <CalibrationElapsed />}
        </div>
        <ol className="space-y-1.5">{steps.map(renderStep)}</ol>
      </section>
    );
  }

  // A well, not a card: the step's own work is the page's subject and this is the context
  // beside it.
  return (
    <InsetPanel padding="lg" className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <aside aria-label={t("iot.calibration.rail.title")} className="space-y-5">
        {renderDevice()}
        {renderBench()}
        {renderSteps()}
      </aside>
    </InsetPanel>
  );
}
