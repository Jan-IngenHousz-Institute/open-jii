"use client";

import type { RigRole, useCalibrationRig } from "@/hooks/iot/useCalibrationRig/useCalibrationRig";
import { useIotBrowserSupport } from "@/hooks/iot/useIotBrowserSupport";
import type { IotDeviceConnection } from "@/hooks/iot/useIotConnections/useIotConnections";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Cable, Loader2 } from "lucide-react";
import { useId } from "react";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

export type CalibrationRig = ReturnType<typeof useCalibrationRig>;

interface CalibrationConnectStepProps {
  family: SensorFamily;
  connection: IotDeviceConnection | undefined;
  isConnecting: boolean;
  error: string | null;
  rig: CalibrationRig;
  onConnect: () => void;
  onDisconnect: () => void;
}

const SECTION_HEADING = "text-muted-foreground text-xs font-medium uppercase tracking-wide";
const PORT_ROW =
  "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3";

/** The platform never reaches hardware; this browser session is the only bridge. */
export function CalibrationConnectStep({
  family,
  connection,
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

  function renderDeviceAction() {
    if (isConnected) {
      return (
        <Button type="button" variant="outline" size="sm" onClick={onDisconnect}>
          {t("iot.calibration.connect.disconnect")}
        </Button>
      );
    }
    return (
      <Button type="button" size="sm" onClick={onConnect} disabled={isPortActionBlocked}>
        {isConnecting ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Cable className="mr-2 size-4" aria-hidden />
        )}
        {isConnecting
          ? t("iot.calibration.connect.connecting")
          : t("iot.calibration.connect.action")}
      </Button>
    );
  }

  function renderConnectedLine(label: string, detail: string | undefined) {
    return (
      <p className="flex w-full flex-wrap items-center gap-2 text-sm">
        <Cable className="size-4 shrink-0" aria-hidden />
        {label}
        {detail !== undefined && (
          <span className="text-muted-foreground font-mono text-xs">{detail}</span>
        )}
      </p>
    );
  }

  // The same row as every instrument below: the device is one more port on the rig.
  function renderDevice() {
    return (
      <section className="space-y-2">
        <h3 className={SECTION_HEADING}>{t("iot.calibration.connect.deviceTitle")}</h3>
        <div className={PORT_ROW}>
          <p className="text-sm font-medium">{getSensorFamilyLabel(family)}</p>
          {renderDeviceAction()}
          {connection !== undefined &&
            renderConnectedLine(
              t("iot.calibration.connect.connected", { name: connection.label }),
              connection.identity.firmwareVersion,
            )}
        </div>
        {wrongFamilyMessage !== null && (
          <Alert variant="destructive">
            <AlertDescription>{wrongFamilyMessage}</AlertDescription>
          </Alert>
        )}
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
      </section>
    );
  }

  function renderRoleStatus(role: RigRole) {
    const status = role.status;
    switch (status.kind) {
      case "idle":
      case "connecting":
        return null;
      case "connected":
        return renderConnectedLine(t("iot.calibration.connect.roleConnected"), status.model);
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

  function renderRoleAction(role: RigRole) {
    if (role.status.kind === "connected") {
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPortActionBlocked}
          onClick={() => void rig.disconnectRole(role.role)}
        >
          {t("iot.calibration.connect.disconnect")}
        </Button>
      );
    }

    const isOpening = role.status.kind === "connecting";

    return (
      <Button
        type="button"
        size="sm"
        disabled={isPortActionBlocked}
        onClick={() => void rig.connectRole(role.role)}
      >
        {isOpening ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Cable className="mr-2 size-4" aria-hidden />
        )}
        {isOpening
          ? t("iot.calibration.connect.roleConnecting")
          : t("iot.calibration.connect.roleAction")}
      </Button>
    );
  }

  // Being needed is the default, so only an optional role says anything about it; what is
  // still missing is named once, under the list, where it blocks the run.
  function renderRole(role: RigRole) {
    return (
      <li key={role.role} className={PORT_ROW}>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{role.role}</p>
          <p className="text-muted-foreground text-xs">
            {t("iot.calibration.connect.roleHandshake")}{" "}
            <span className="font-mono">{role.handshake}</span>
          </p>
          {!role.required && (
            <p className="text-muted-foreground text-xs">
              {t("iot.calibration.connect.roleOptional")}
            </p>
          )}
        </div>
        {renderRoleAction(role)}
        {renderRoleStatus(role)}
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
