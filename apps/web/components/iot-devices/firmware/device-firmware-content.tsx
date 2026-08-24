"use client";

import { FirmwareDeliveryGuide } from "@/components/iot-devices/firmware/firmware-delivery-guide";
import { FirmwareReleaseList } from "@/components/iot-devices/firmware/firmware-release-list";
import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useDeviceFirmwareHistory } from "@/hooks/iot/useDeviceFirmwareHistory/useDeviceFirmwareHistory";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useIotFirmwareReleases } from "@/hooks/iot/useIotFirmwareReleases/useIotFirmwareReleases";
import { useLocale } from "@/hooks/useLocale";
import { getOrpcError } from "@/lib/orpc";
import {
  hasManagedFirmware,
  isSameFirmwareVersion,
  latestReportedVersion,
} from "@/util/firmware-family";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

// Firmware is reported with measurements, so the window has to be wide enough
// that a daily-reporting device still tells us what it runs.
const FIRMWARE_LOOKBACK = "last30d" as const;

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
  const family = device?.deviceType;
  const isManaged = family !== undefined && hasManagedFirmware(family);

  // Both queries wait for the family: a device with no JII firmware line shows
  // no tab, so neither the warehouse scan nor the release read is worth paying.
  const range = useMemo(() => resolveMonitoringPreset(FIRMWARE_LOOKBACK), []);
  const {
    data: firmwareHistory,
    isError: isHistoryError,
    isLoading: isHistoryLoading,
  } = useDeviceFirmwareHistory(deviceId, range, { enabled: isManaged });

  // Only a placeholder to keep the input typed: the query is held until the
  // device reports a family JII publishes for.
  const releasesFamily = isManaged ? family : "ambyte";
  const {
    data: releases,
    isLoading,
    isError,
    error,
    refetch: refetchReleases,
  } = useIotFirmwareReleases(releasesFamily, { enabled: isManaged });

  // A family with no repository configured yet is a gap, not a fault: the
  // backend answers 404 for it, and "we publish nothing here yet" is the
  // honest thing to show rather than a generic failure.
  const hasNoFirmwareLine = getOrpcError(error)?.status === 404;

  // Families without a JII firmware line have no tab; a direct visit leaves.
  const detailPath = `/${locale}/platform/devices/${deviceId}`;
  const hasNoSurface = device !== undefined && !isManaged;

  useEffect(() => {
    // `replace`, not `push`: this route is not somewhere to come back to.
    if (hasNoSurface) {
      router.replace(detailPath);
    }
  }, [hasNoSurface, detailPath, router]);

  if (device === undefined || !isManaged) {
    return null;
  }

  const installed = latestReportedVersion(firmwareHistory?.versions ?? []);
  const latest = (releases?.releases ?? []).find((release) => release.latest) ?? null;

  function renderReleases() {
    if (hasNoFirmwareLine) {
      return <EmptyState size="inline" description={t("iot.devices.firmware.noFirmwareLine")} />;
    }
    if (isError) {
      return (
        <EmptyState
          size="inline"
          variant="error"
          description={t("iot.devices.firmware.loadError")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchReleases();
              }}
            >
              {t("iot.onboarding.retry")}
            </Button>
          }
        />
      );
    }
    if (isLoading) {
      return <Skeleton className="h-48 w-full rounded-lg" />;
    }
    return <FirmwareReleaseList releases={releases?.releases ?? []} installedVersion={installed} />;
  }

  // Sequential guards rather than precomputed flags: each arm narrows the two
  // nullable versions it actually reads.
  function renderStatus() {
    // An unfinished scan reads as `installed === null` too, so answer it before
    // the guards below claim the device never reported.
    if (isHistoryLoading) {
      return <Skeleton className="h-5 w-64" />;
    }
    // A failed scan is not the same as a device that never reported, and
    // saying "has not reported" for a warehouse error would be a lie.
    if (isHistoryError) {
      return (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {t("iot.devices.firmware.versionUnavailable")}
        </p>
      );
    }
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
      <TabBodyHeader
        title={t("iot.devices.firmware.title")}
        description={t("iot.devices.firmware.description")}
      />

      <PanelCard title={t("iot.devices.firmware.currentTitle")}>{renderStatus()}</PanelCard>

      <PanelCard
        title={t("iot.devices.firmware.releasesTitle")}
        description={t("iot.devices.firmware.releasesHint")}
      >
        {renderReleases()}
      </PanelCard>

      <FirmwareDeliveryGuide />
    </div>
  );
}
