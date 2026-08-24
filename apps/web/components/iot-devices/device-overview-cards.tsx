"use client";

import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useDeviceFirmwareHistory } from "@/hooks/iot/useDeviceFirmwareHistory/useDeviceFirmwareHistory";
import { useIotDeviceActivity } from "@/hooks/iot/useIotDeviceActivity/useIotDeviceActivity";
import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { hasManagedFirmware, latestReportedVersion } from "@/util/firmware-family";
import Link from "next/link";
import { useMemo } from "react";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ConnectivityDot } from "./device-connectivity";
import { IotDeviceStatusBadge } from "./iot-device-status-badge";

interface DeviceOverviewCardsProps {
  device: IotDeviceDetail;
}

/**
 * The overview's stitched summary cards: what each neighbouring tab would say,
 * with a link into it. The overview stops being a dead end of metadata; every
 * fact here leads somewhere.
 */
export function DeviceOverviewCards({ device }: DeviceOverviewCardsProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const {
    data: boundData,
    isLoading: isLoadingBound,
    isError: isBoundError,
    refetch: refetchBound,
  } = useDeviceExperiments(device.id);
  const bound = boundData ?? [];

  const { data: activity } = useIotDeviceActivity(device.id);

  const isMobileFamily = device.deviceType === "mobile";
  const isManagedFirmware = hasManagedFirmware(device.deviceType);
  // Firmware is reported with measurements; 30 days covers a daily reporter.
  const firmwareRange = useMemo(() => resolveMonitoringPreset("last30d"), []);
  const { data: firmwareHistory, isLoading: isLoadingFirmware } = useDeviceFirmwareHistory(
    device.id,
    firmwareRange,
    { enabled: isManagedFirmware },
  );

  const basePath = `/${locale}/platform/devices/${device.id}`;

  function renderBoundExperiment(experiment: (typeof bound)[number]) {
    return (
      <li key={experiment.id} className="flex items-center gap-3 px-3 py-2">
        <Link
          href={`/${locale}/platform/experiments/${experiment.id}`}
          className="focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 flex-1 truncate text-sm font-medium hover:underline focus-visible:ring-2"
        >
          {experiment.name}
        </Link>
        <Badge variant="secondary" className="shrink-0">
          {t("iot.devices.detail.cards.streaming")}
        </Badge>
      </li>
    );
  }

  function renderExperimentsBody() {
    if (isLoadingBound) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      );
    }
    if (isBoundError) {
      return (
        <EmptyState
          size="inline"
          variant="error"
          description={t("iot.devices.detail.cards.experimentsError")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchBound();
              }}
            >
              {t("iot.onboarding.retry")}
            </Button>
          }
        />
      );
    }
    if (bound.length === 0) {
      return (
        <EmptyState size="inline" description={t("iot.devices.detail.cards.experimentsEmpty")} />
      );
    }
    return <ul className="divide-y rounded-lg border">{bound.map(renderBoundExperiment)}</ul>;
  }

  function activityLine(): string {
    if (activity === undefined) {
      return t("iot.devices.detail.cards.activityLoading");
    }
    if (activity.pipelineUnavailable) {
      return t("iot.devices.monitoring.lastDataUnavailable");
    }
    if (activity.lastDataAt === null) {
      return t("iot.devices.detail.cards.activityNoData");
    }
    return t("iot.devices.detail.cards.activityLastData", {
      time: formatRelativeTime(activity.lastDataAt, locale),
    });
  }

  function renderActivityBody() {
    return (
      <div className="space-y-2">
        <ConnectivityDot connectivity={device.connectivity} />
        <CardDescription>{activityLine()}</CardDescription>
      </div>
    );
  }

  function renderFirmwareBody() {
    if (isLoadingFirmware) {
      return <Skeleton className="h-5 w-40" />;
    }
    const reported = latestReportedVersion(firmwareHistory?.versions ?? []);
    return (
      <CardDescription>
        {reported === null ? (
          t("iot.devices.detail.cards.firmwareUnknown")
        ) : (
          <span className="text-foreground font-mono text-sm">{reported}</span>
        )}
      </CardDescription>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {!isMobileFamily && (
        <Card className="shadow-none">
          <CardHeader className="flex-row items-baseline justify-between space-y-0">
            <CardTitle className="text-base">
              {t("iot.devices.detail.cards.credentialsTitle")}
            </CardTitle>
            {device.capabilities.canManage && (
              <Link
                href={`${basePath}/credentials`}
                className="text-primary text-sm font-medium hover:underline"
              >
                {t("iot.devices.detail.cards.manageLink")}
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <IotDeviceStatusBadge status={device.status} />
            <CardDescription>
              {t(`iot.devices.detail.cards.credentialHint.${device.status}`)}
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {!isMobileFamily && (
        <Card className="shadow-none">
          <CardHeader className="flex-row items-baseline justify-between space-y-0">
            <CardTitle className="text-base">
              {t("iot.devices.detail.cards.experimentsTitle")}
            </CardTitle>
            <Link
              href={`${basePath}/onboarding`}
              className="text-primary text-sm font-medium hover:underline"
            >
              {t("iot.devices.detail.cards.onboardLink")}
            </Link>
          </CardHeader>
          <CardContent>{renderExperimentsBody()}</CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardHeader className="flex-row items-baseline justify-between space-y-0">
          <CardTitle className="text-base">{t("iot.devices.detail.cards.activityTitle")}</CardTitle>
          <Link
            href={`${basePath}/monitoring`}
            className="text-primary text-sm font-medium hover:underline"
          >
            {t("iot.devices.detail.cards.monitoringLink")}
          </Link>
        </CardHeader>
        <CardContent>{renderActivityBody()}</CardContent>
      </Card>

      {isManagedFirmware && (
        <Card className="shadow-none">
          <CardHeader className="flex-row items-baseline justify-between space-y-0">
            <CardTitle className="text-base">
              {t("iot.devices.detail.cards.firmwareTitle")}
            </CardTitle>
            <Link
              href={`${basePath}/firmware`}
              className="text-primary text-sm font-medium hover:underline"
            >
              {t("iot.devices.detail.cards.firmwareLink")}
            </Link>
          </CardHeader>
          <CardContent>{renderFirmwareBody()}</CardContent>
        </Card>
      )}
    </div>
  );
}
