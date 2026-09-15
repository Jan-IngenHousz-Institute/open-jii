"use client";

import type { RigRole, useCalibrationRig } from "@/hooks/iot/useCalibrationRig/useCalibrationRig";
import { useIotBrowserSupport } from "@/hooks/iot/useIotBrowserSupport";
import type { IotDeviceConnection } from "@/hooks/iot/useIotConnections/useIotConnections";
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

  const isWrongFamily = connection !== undefined && connection.family !== family;
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

  function renderConnected(connected: IotDeviceConnection) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm">
          <Cable className="size-4" aria-hidden />
          {t("iot.calibration.connect.connected", { name: connected.label })}
          {connected.identity.firmwareVersion !== undefined && (
            <span className="text-muted-foreground font-mono text-xs">
              {connected.identity.firmwareVersion}
            </span>
          )}
        </p>
        {isWrongFamily && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.connect.wrongFamily", {
                expected: family,
                actual: connected.family,
              })}
            </AlertDescription>
          </Alert>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onDisconnect}>
          {t("iot.calibration.connect.disconnect")}
        </Button>
      </div>
    );
  }

  function renderDisconnected() {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">{t("iot.calibration.connect.hint")}</p>
        {unsupportedReason !== null && (
          <Alert>
            <AlertDescription>{unsupportedReason}</AlertDescription>
          </Alert>
        )}
        {error !== null && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="button" onClick={onConnect} disabled={isPortActionBlocked}>
          {isConnecting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Cable className="mr-2 size-4" aria-hidden />
          )}
          {isConnecting
            ? t("iot.calibration.connect.connecting")
            : t("iot.calibration.connect.action")}
        </Button>
      </div>
    );
  }

  function renderRoleStatus(role: RigRole) {
    const status = role.status;
    switch (status.kind) {
      case "idle":
      case "connecting":
        return null;
      case "connected":
        return (
          <p className="flex items-center gap-2 text-sm">
            <Cable className="size-4" aria-hidden />
            {t("iot.calibration.connect.roleConnected")}
            <span className="text-muted-foreground font-mono text-xs">{status.model}</span>
          </p>
        );
      case "mismatch":
        return (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.connect.roleMismatch")}
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

  function renderRole(role: RigRole) {
    return (
      <li key={role.role} className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">{role.role}</p>
            <p className="text-muted-foreground text-xs">
              {t("iot.calibration.connect.roleHandshake")}{" "}
              <span className="font-mono">{role.handshake}</span>
            </p>
            <p className="text-muted-foreground text-xs">
              {role.required
                ? t("iot.calibration.connect.roleRequired")
                : t("iot.calibration.connect.roleOptional")}
            </p>
          </div>
          {renderRoleAction(role)}
        </div>
        {renderRoleStatus(role)}
      </li>
    );
  }

  function renderBench() {
    if (rig.roles.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3">
        <h3 id={benchHeadingId} className="text-sm font-medium">
          {t("iot.calibration.connect.roleHeading")}
        </h3>
        <p className="text-muted-foreground text-sm">{t("iot.calibration.connect.roleHint")}</p>
        <ul aria-labelledby={benchHeadingId} className="space-y-3">
          {rig.roles.map(renderRole)}
        </ul>
        {hasMissingRoles && (
          <Alert>
            <AlertDescription>
              {t("iot.calibration.connect.roleMissing")}
              <span className="mt-1 block font-mono text-xs">{missingRoleNames}</span>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {connection ? renderConnected(connection) : renderDisconnected()}
      {renderBench()}
    </div>
  );
}
