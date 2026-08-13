"use client";

import { ConnectivityDot, useFormatLastSeen } from "@/components/iot-devices/device-connectivity";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useIotDeviceActivity } from "@/hooks/iot/useIotDeviceActivity/useIotDeviceActivity";
import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

const CONNECTIVITY_POLL_MS = 15_000;

/**
 * Live connectivity (fleet index, polled) next to the pipeline-computed last
 * data arrival. The two signals deliberately differ in freshness: connectivity
 * is seconds-fresh, last data always lags by pipeline cadence and says so.
 */
export default function DeviceMonitoringPage() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;

  const { data: device, isLoading: isDeviceLoading } = useIotDevice(deviceId, {
    refetchInterval: CONNECTIVITY_POLL_MS,
  });
  const { data: activity, isLoading: isActivityLoading } = useIotDeviceActivity(deviceId);

  const formatLastSeen = useFormatLastSeen();

  const lastDataLabel = () => {
    const lastDataAt = activity?.lastDataAt ?? null;
    if (lastDataAt === null) {
      return t("iot.devices.monitoring.noData");
    }
    return formatRelativeTime(lastDataAt, locale);
  };

  return (
    <Card className="max-w-3xl shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{t("iot.devices.monitoring.title")}</CardTitle>
        <CardDescription>{t("iot.devices.monitoring.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 space-y-3 rounded-lg p-3">
          <div>
            <p className="text-xs font-medium">{t("iot.devices.monitoring.state")}</p>
            {isDeviceLoading || !device ? (
              <Skeleton className="mt-1 h-4 w-24" />
            ) : (
              <ConnectivityDot connectivity={device.connectivity} />
            )}
          </div>

          <div>
            <p className="text-xs font-medium">{t("iot.devices.monitoring.lastSeen")}</p>
            {isDeviceLoading || !device ? (
              <Skeleton className="mt-1 h-4 w-32" />
            ) : (
              <p className="text-sm text-[#68737B]">{formatLastSeen(device.connectivity)}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium">{t("iot.devices.monitoring.lastData")}</p>
            {isActivityLoading ? (
              <Skeleton className="mt-1 h-4 w-32" />
            ) : (
              <p className="text-sm text-[#68737B]">{lastDataLabel()}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-[#68737B]">{t("iot.devices.monitoring.pipelineNote")}</p>
      </CardContent>
    </Card>
  );
}
