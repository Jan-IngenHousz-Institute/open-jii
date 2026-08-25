"use client";

import { formatDate } from "@/util/date";
import { presentDevice, resolveDeviceRoleLabels } from "@/util/device-presentation";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import type { ReactNode } from "react";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";

import { VisibilityBadge } from "../visibility/visibility-badge";
import { useFormatLastSeen } from "./device-connectivity";

/**
 * The device's identity facts as the overview's sidebar, in the organization
 * About card's grammar: stacked label-over-value rows in one narrow column,
 * so the facts read as one thing while the hub cards keep the room.
 */
export function DeviceAboutCard({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");
  const formatLastSeen = useFormatLastSeen();

  const present = presentDevice({
    name: device.name,
    family: device.deviceType,
    id: device.serialNumber,
  });
  const roleLabels = resolveDeviceRoleLabels(present, t);

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold tracking-tight">
        {t("iot.devices.detail.about.title")}
      </h2>

      <dl className="mt-4 space-y-3">
        <Row label={t("iot.devices.detail.meta.serial")}>
          <span className="break-all font-mono">{device.serialNumber}</span>
        </Row>
        <Row label={t("iot.devices.detail.meta.type")}>
          {getSensorFamilyLabel(device.deviceType)}
        </Row>
        {roleLabels.length > 0 && (
          <Row label={t("iot.devices.detail.meta.role")}>{roleLabels.join(" · ")}</Row>
        )}
        <Row label={t("iot.devices.detail.meta.registered")}>{formatDate(device.createdAt)}</Row>
        <Row label={t("iot.devices.detail.meta.thingName")}>
          <span className="break-all font-mono">{device.thingName}</span>
        </Row>
        <Row label={t("iot.devices.detail.meta.visibility")}>
          <VisibilityBadge visibility={device.visibility} />
        </Row>
        <Row label={t("iot.devices.detail.meta.lastSeen")}>
          {formatLastSeen(device.connectivity)}
        </Row>
      </dl>
    </Card>
  );
}

/** Stacked label over value: nothing competes for width in a narrow column. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
