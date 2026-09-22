"use client";

import type { UnitIdentity } from "@/hooks/iot/useCalibrationCapture/useCalibrationCapture";
import type { RigRole, useCalibrationRig } from "@/hooks/iot/useCalibrationRig/useCalibrationRig";
import { useIotBrowserSupport } from "@/hooks/iot/useIotBrowserSupport";
import type { IotDeviceConnection } from "@/hooks/iot/useIotConnections/useIotConnections";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Loader2 } from "lucide-react";
import { useId } from "react";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

import { CalibrationPortRow } from "./calibration-port-row";
import type { PortState } from "./calibration-port-row";

export type CalibrationRig = ReturnType<typeof useCalibrationRig>;

interface CalibrationConnectStepProps {
  family: SensorFamily;
  connection: IotDeviceConnection | undefined;
  /** Whether the unit that answered is the device this session is for. */
  unit: UnitIdentity | undefined;
  isConnecting: boolean;
  error: string | null;
  rig: CalibrationRig;
  onConnect: () => void;
  onDisconnect: () => void;
}

const SECTION_HEADING = "text-muted-foreground text-xs font-medium uppercase tracking-wide";

const ROLE_STATE: Record<RigRole["status"]["kind"], PortState> = {
  idle: "idle",
  connecting: "connecting",
  connected: "connected",
  mismatch: "failed",
  unrecognised: "failed",
  failed: "failed",
};

/** The platform never reaches hardware; this browser session is the only bridge. */
export function CalibrationConnectStep({
  family,
  connection,
  unit,
  isConnecting,
  error,
  rig,
  onConnect,
  onDisconnect,
}: CalibrationConnectStepProps) {
  const { t } = useTranslation("iot");
  const support = useIotBrowserSupport(family);
  const benchHeadingId = useId();

  const isConnected = connection !== undefined;
  const wrongFamilyMessage =
    connection !== undefined && connection.family !== family
      ? t("iot.calibration.connect.wrongFamily", { expected: family, actual: connection.family })
      : null;
  // Each port needs a gesture of its own, so nothing else opens while one request is in flight.
  const isOpeningPort = isConnecting || rig.isConnecting;
  const isPortActionBlocked = isOpeningPort || !support.serial;
  const missingRoles = rig.roles.filter(
    (role) => role.required && role.status.kind !== "connected",
  );
  const missingRoleNames = missingRoles.map((role) => role.role).join(", ");
  const hasMissingRoles = missingRoles.length > 0;
  const unsupportedReason =
    support.serialReason === "browser"
      ? t("iot.calibration.connect.unsupportedBrowser")
      : support.serialReason === "device"
        ? t("iot.calibration.connect.unsupportedDevice")
        : null;

  // Opening a port is the step's work, repeated once per instrument; the wizard's own
  // Continue is the only filled button on the page.
  function renderPortButton(label: string, isOpening: boolean, onClick: () => void) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPortActionBlocked}
        onClick={onClick}
      >
        {isOpening && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
        {label}
      </Button>
    );
  }

  function renderReleaseButton(onClick: () => void) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPortActionBlocked}
        onClick={onClick}
      >
        {t("iot.calibration.connect.disconnect")}
      </Button>
    );
  }

  function renderDetail(label: string, value: string | undefined) {
    return (
      <>
        {label} {value !== undefined && <span className="font-mono">{value}</span>}
      </>
    );
  }

  // Coefficients are written to whatever is on the port, so what answered has to be the
  // device the session is for. A unit whose handshake announced no identifier cannot be
  // checked, and the row says that rather than implying it passed.
  function renderIdentity() {
    if (unit === undefined) {
      return null;
    }
    if (unit.kind === "mismatch") {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            {t("iot.calibration.connect.wrongUnit", {
              reported: unit.reported,
              expected: unit.expected,
            })}
          </AlertDescription>
        </Alert>
      );
    }
    if (unit.kind === "unnamed") {
      return (
        <Alert>
          <AlertDescription>{t("iot.calibration.connect.unnamedUnit")}</AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  function renderDevice() {
    // Nothing to say about a port that has not been opened; the family is the row's title.
    const detail =
      connection === undefined
        ? undefined
        : renderDetail(
            t("iot.calibration.connect.connected", { name: connection.label }),
            connection.identity.firmwareVersion,
          );

    return (
      <section className="space-y-2">
        <h3 className={SECTION_HEADING}>{t("iot.calibration.connect.deviceTitle")}</h3>
        <CalibrationPortRow
          state={isConnected ? "connected" : isConnecting ? "connecting" : "idle"}
          title={getSensorFamilyLabel(family)}
          detail={detail}
          note={
            unit?.kind === "match"
              ? t("iot.calibration.connect.unitConfirmed", { serial: unit.serial })
              : unit?.kind === "reported"
                ? t("iot.calibration.connect.unitNamed", { serial: unit.serial })
                : undefined
          }
          action={
            isConnected
              ? renderReleaseButton(onDisconnect)
              : renderPortButton(
                  isConnecting
                    ? t("iot.calibration.connect.connecting")
                    : t("iot.calibration.connect.action"),
                  isConnecting,
                  onConnect,
                )
          }
        >
          {wrongFamilyMessage !== null && (
            <Alert variant="destructive">
              <AlertDescription>{wrongFamilyMessage}</AlertDescription>
            </Alert>
          )}
          {isConnected && wrongFamilyMessage === null && renderIdentity()}
          {!isConnected && unsupportedReason !== null && (
            <Alert>
              <AlertDescription>{unsupportedReason}</AlertDescription>
            </Alert>
          )}
          {!isConnected && error !== null && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CalibrationPortRow>
      </section>
    );
  }

  function renderRoleRefusal(role: RigRole) {
    const status = role.status;
    switch (status.kind) {
      case "idle":
      case "connecting":
      case "connected":
        return null;
      case "mismatch":
        return (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.connect.roleMismatch", { model: status.model })}
              <span className="mt-1 block font-mono text-xs">{status.reply}</span>
            </AlertDescription>
          </Alert>
        );
      case "unrecognised":
        return (
          <Alert variant="destructive">
            <AlertDescription>{t("iot.calibration.connect.roleUnrecognised")}</AlertDescription>
          </Alert>
        );
      case "failed":
        return (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.connect.roleFailed")}
              <span className="mt-1 block font-mono text-xs">{status.message}</span>
            </AlertDescription>
          </Alert>
        );
    }
  }

  // Being needed is the default, so only an optional role says anything about it; what is
  // still missing is named once, under the list, where it blocks the run.
  function renderRole(role: RigRole) {
    const status = role.status;
    const detail =
      status.kind === "connected"
        ? renderDetail(t("iot.calibration.connect.roleConnected"), status.model)
        : renderDetail(t("iot.calibration.connect.roleHandshake"), role.handshake);

    return (
      <li key={role.role}>
        <CalibrationPortRow
          state={ROLE_STATE[status.kind]}
          title={role.role}
          detail={detail}
          note={role.required ? undefined : t("iot.calibration.connect.roleOptional")}
          action={
            status.kind === "connected"
              ? renderReleaseButton(() => void rig.disconnectRole(role.role))
              : renderPortButton(
                  status.kind === "connecting"
                    ? t("iot.calibration.connect.roleConnecting")
                    : t("iot.calibration.connect.roleAction"),
                  status.kind === "connecting",
                  () => void rig.connectRole(role.role),
                )
          }
        >
          {renderRoleRefusal(role)}
        </CalibrationPortRow>
      </li>
    );
  }

  function renderBench() {
    if (rig.roles.length === 0) {
      return null;
    }

    return (
      <section className="space-y-2">
        <h3 id={benchHeadingId} className={SECTION_HEADING}>
          {t("iot.calibration.connect.roleHeading")}
        </h3>
        <p className="text-muted-foreground text-sm">{t("iot.calibration.connect.roleHint")}</p>
        <ul aria-labelledby={benchHeadingId} className="space-y-2">
          {rig.roles.map(renderRole)}
        </ul>
        {hasMissingRoles && (
          <p className="text-muted-foreground text-sm">
            {t("iot.calibration.connect.roleMissing")}{" "}
            <span className="font-mono">{missingRoleNames}</span>
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {renderDevice()}
      {renderBench()}
    </div>
  );
}
