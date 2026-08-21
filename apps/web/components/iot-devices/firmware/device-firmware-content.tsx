"use client";

import { FirmwareDeliveryGuide } from "@/components/iot-devices/firmware/firmware-delivery-guide";
import { FirmwareReleaseList } from "@/components/iot-devices/firmware/firmware-release-list";
import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useDeviceFirmwareHistory } from "@/hooks/iot/useDeviceFirmwareHistory/useDeviceFirmwareHistory";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useIotFirmwareReleases } from "@/hooks/iot/useIotFirmwareReleases/useIotFirmwareReleases";
import { useLocale } from "@/hooks/useLocale";
import { hasManagedFirmware, isSameFirmwareVersion } from "@/util/firmware-family";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import type { DeviceFirmwareHistory } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

// Firmware is reported with measurements, so the window has to be wide enough
// that a daily-reporting device still tells us what it runs.
const FIRMWARE_LOOKBACK = "last30d" as const;

/** Latest reported version in the window; null when the device never said. */
function reportedVersion(history: DeviceFirmwareHistory | undefined): string | null {
  if (history === undefined) {
    return null;
  }
  let current: { version: string; lastSeen: string } | null = null;
  for (const entry of history.versions) {
    if (entry.version === null) {
      continue;
    }
    if (current === null || entry.lastSeen > current.lastSeen) {
      current = { version: entry.version, lastSeen: entry.lastSeen };
    }
  }
  return current === null ? null : current.version;
}

/**
 * Read-only firmware surface: what this device runs, what JII has published,
 * and how an update reaches it. Rollouts are started from a reviewed workflow,
 * never from here.
 */
export default function DeviceFirmwarePage() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;
  const router = useRouter();

  const { data: device } = useIotDevice(deviceId);
  const range = useMemo(() => resolveMonitoringPreset(FIRMWARE_LOOKBACK), []);
  const { data: firmwareHistory } = useDeviceFirmwareHistory(deviceId, range);

  const family = device?.deviceType;
  const isManaged = family !== undefined && hasManagedFirmware(family);

  // Only a placeholder to keep the input typed: the query is held until the
  // device reports a family JII publishes for.
  const releasesFamily = isManaged ? family : "ambyte";
  const {
    data: releases,
    isLoading,
    isError,
  } = useIotFirmwareReleases(releasesFamily, { enabled: isManaged });

  // Families without a JII firmware line have no tab; a direct visit leaves.
  const detailPath = `/${locale}/platform/devices/${deviceId}`;
  const hasNoSurface = device !== undefined && !isManaged;

  useEffect(() => {
    // `replace`, not `push`: this route is not somewhere to come back to.
    if (hasNoSurface) router.replace(detailPath);
  }, [hasNoSurface, detailPath, router]);

  if (device === undefined || !isManaged) {
    return null;
  }

  const installed = reportedVersion(firmwareHistory);
  const latest = (releases?.releases ?? []).find((release) => release.latest) ?? null;

  // Sequential guards rather than precomputed flags: each arm narrows the two
  // nullable versions it actually reads.
  function renderStatus() {
    if (installed === null) {
      return (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <HelpCircle className="h-4 w-4" aria-hidden />
          {t("iot.devices.firmware.unknownVersion")}
        </p>
      );
    }
    if (latest === null) {
      return (
        <p className="text-sm">{t("iot.devices.firmware.reported", { version: installed })}</p>
      );
    }
    if (isSameFirmwareVersion(installed, latest.version)) {
      return (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {t("iot.devices.firmware.upToDate", { version: installed })}
        </p>
      );
    }
    return (
      <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {t("iot.devices.firmware.updateAvailable", { installed, latest: latest.version })}
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-medium">{t("iot.devices.firmware.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("iot.devices.firmware.description")}</p>
      </div>

      <PanelCard title={t("iot.devices.firmware.currentTitle")}>{renderStatus()}</PanelCard>

      <PanelCard
        title={t("iot.devices.firmware.releasesTitle")}
        description={t("iot.devices.firmware.releasesHint")}
      >
        {isError ? (
          <Card className="shadow-none">
            <CardContent className="text-muted-foreground py-6 text-center text-sm">
              {t("iot.devices.firmware.loadError")}
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : (
          <FirmwareReleaseList releases={releases?.releases ?? []} installedVersion={installed} />
        )}
      </PanelCard>

      <FirmwareDeliveryGuide />
    </div>
  );
}
