"use client";

import { ConnectivityDot } from "@/components/iot-devices/device-connectivity";
import { IotDeviceStatusBadge } from "@/components/iot-devices/iot-device-status-badge";
import { EntityLink } from "@/components/iot-devices/monitoring/entity-link";
import { useLocale } from "@/hooks/useLocale";
import { formatDateTime, formatRelativeTime } from "@/util/date";

import type { DeviceMonitoring, IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

import type { LineageNodeModel } from "./build-device-lineage";
import { lineageNodeTitle } from "./lineage-title";

const RECENT_LIMIT = 5;

interface LineageInspectPanelProps {
  selected: LineageNodeModel | null;
  device: IotDeviceDetail;
  monitoring: DeviceMonitoring;
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </div>
  );
}

/**
 * Details for the selected lineage node. Links to other resources live here,
 * so the canvas itself stays a pure select surface.
 */
export function LineageInspectPanel({ selected, device, monitoring }: LineageInspectPanelProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  if (selected === null) {
    return (
      <Card className="shadow-none">
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          {t("iot.devices.lineage.inspectHint")}
        </CardContent>
      </Card>
    );
  }

  function renderDetails(selected: LineageNodeModel) {
    if (selected.kind === "device") {
      return (
        <>
          <FactRow
            label={t("iot.devices.lineage.thingNameLabel")}
            value={<span className="font-mono text-xs">{device.thingName}</span>}
          />
          <FactRow
            label={t("iot.devices.lineage.serialLabel")}
            value={<span className="font-mono text-xs">{device.serialNumber}</span>}
          />
          <FactRow label={t("iot.devices.lineage.familyLabel")} value={selected.family} />
          <FactRow
            label={t("iot.devices.lineage.statusLabel")}
            value={<IotDeviceStatusBadge status={selected.status} />}
          />
          {device.certificateId !== null && (
            <FactRow
              label={t("iot.devices.lineage.certificateLabel")}
              value={<span className="font-mono text-xs">{device.certificateId}</span>}
            />
          )}
          {selected.firmwareVersion !== null && (
            <FactRow
              label={t("iot.devices.lineage.firmwareLabel")}
              value={selected.firmwareVersion}
            />
          )}
        </>
      );
    }

    if (selected.kind === "broker") {
      return (
        <>
          <FactRow
            label={t("iot.devices.lineage.thingNameLabel")}
            value={<span className="font-mono text-xs">{selected.thingName}</span>}
          />
          <FactRow
            label={t("iot.devices.lineage.connectivityLabel")}
            value={<ConnectivityDot connectivity={selected.connectivity} />}
          />
          {selected.uptimePercent !== null && (
            <FactRow
              label={t("iot.devices.lineage.uptimeLabel")}
              value={`${String(Math.round(selected.uptimePercent))}%`}
            />
          )}
          <FactRow label={t("iot.devices.lineage.sessionsLabel")} value={selected.sessionCount} />
          <p className="text-muted-foreground pt-1 text-xs">
            {t("iot.devices.lineage.brokerHint")}
          </p>
        </>
      );
    }

    if (selected.kind === "warehouse") {
      return (
        <>
          <FactRow
            label={t("iot.devices.monitoring.measurements")}
            value={selected.totalMeasurements}
          />
          <FactRow label={t("iot.devices.monitoring.workbookRuns")} value={selected.workbookRuns} />
          <FactRow label={t("iot.devices.monitoring.gpsCoverage")} value={selected.withGps} />
          <FactRow
            label={t("iot.devices.monitoring.batteryCoverage")}
            value={selected.withBattery}
          />
          <FactRow
            label={t("iot.devices.lineage.lastDataLabel")}
            value={
              selected.lastDataAt === null
                ? t("iot.devices.monitoring.noData")
                : formatRelativeTime(selected.lastDataAt, locale)
            }
          />
          <p className="text-muted-foreground pt-1 text-xs">
            {t("iot.devices.lineage.warehouseHint")}
          </p>
        </>
      );
    }

    if (selected.kind === "experiment") {
      const recent = monitoring.recentMeasurements
        .filter((measurement) => measurement.experimentId === selected.entity.id)
        .slice(0, RECENT_LIMIT);

      return (
        <>
          <FactRow
            label={t("iot.devices.lineage.experimentLabel")}
            value={<EntityLink entity={selected.entity} />}
          />
          <FactRow
            label={t("iot.devices.lineage.bindingLabel")}
            value={
              selected.bound ? t("iot.devices.lineage.bound") : t("iot.devices.monitoring.notBound")
            }
          />
          <FactRow label={t("iot.devices.monitoring.measurements")} value={selected.count} />
          <FactRow
            label={t("iot.devices.lineage.lastDataLabel")}
            value={
              selected.lastBucketAt === null
                ? t("iot.devices.monitoring.noData")
                : formatRelativeTime(selected.lastBucketAt, locale)
            }
          />
          {recent.length > 0 && (
            <div className="pt-2">
              <p className="text-muted-foreground pb-1 text-xs">
                {t("iot.devices.lineage.recentTitle")}
              </p>
              <ul className="divide-y rounded-md border">
                {recent.map((measurement) => (
                  <li key={measurement.timestamp} className="px-2 py-1.5 text-xs tabular-nums">
                    {formatDateTime(measurement.timestamp, locale)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      );
    }

    if (selected.kind === "unattributed") {
      return (
        <>
          <FactRow label={t("iot.devices.monitoring.measurements")} value={selected.count} />
          <p className="text-muted-foreground pt-1 text-xs">
            {t("iot.devices.lineage.unattributedHint")}
          </p>
        </>
      );
    }

    if (selected.kind === "attribution-other") {
      return (
        <>
          <FactRow label={t("iot.devices.monitoring.measurements")} value={selected.count} />
          <p className="text-muted-foreground pt-1 text-xs">
            {selected.attributionKind === "macro"
              ? t("iot.devices.lineage.macroHint")
              : t("iot.devices.lineage.inputsHint")}
          </p>
        </>
      );
    }

    return (
      <>
        <FactRow
          label={t(`iot.devices.lineage.${selected.kind}Caption`)}
          value={<EntityLink entity={selected.entity} />}
        />
        <FactRow label={t("iot.devices.monitoring.measurements")} value={selected.count} />
        <p className="text-muted-foreground pt-1 text-xs">
          {selected.kind === "macro"
            ? t("iot.devices.lineage.macroHint")
            : t("iot.devices.lineage.inputsHint")}
        </p>
      </>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{lineageNodeTitle(selected, t)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{renderDetails(selected)}</CardContent>
    </Card>
  );
}
