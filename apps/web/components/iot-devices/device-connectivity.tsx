"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDateTime, formatRelativeTime } from "@/util/date";

import type { DeviceConnectivity, IotDevice } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface ConnectivityDotProps {
  connectivity: DeviceConnectivity | null;
  /** A phone connects only while the app is open, so its offline reads as idle, not down. */
  deviceType?: IotDevice["deviceType"];
  /** Lets a caller scale the label, e.g. the monitoring metric tiles. */
  className?: string;
}

/** Broker connectivity: green = online, gray = offline or idle, muted ring = unknown. */
export function ConnectivityDot({ connectivity, deviceType, className }: ConnectivityDotProps) {
  const { t } = useTranslation("iot");

  if (connectivity === null) {
    return (
      <span
        className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-xs", className)}
        title={t("iot.devices.connectivity.unknown")}
      >
        <span className="border-border h-2 w-2 rounded-full border border-dashed" />
        {t("iot.devices.connectivity.unknown")}
      </span>
    );
  }

  if (connectivity.connected) {
    return (
      <span
        className={cn(
          "text-status-active-foreground inline-flex items-center gap-1.5 text-xs",
          className,
        )}
      >
        <span className="bg-status-active-foreground h-2 w-2 animate-pulse rounded-full" />
        {t("iot.devices.connectivity.connected")}
      </span>
    );
  }

  return (
    <span
      className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-xs", className)}
    >
      <span className="bg-border h-2 w-2 shrink-0 rounded-full" />
      {offlineLabel(connectivity, deviceType, t)}
    </span>
  );
}

function offlineLabel(
  connectivity: DeviceConnectivity,
  deviceType: IotDevice["deviceType"] | undefined,
  t: (key: string) => string,
): string {
  if (deviceType === "mobile") {
    return t("iot.devices.connectivity.idle");
  }
  if (connectivity.lastSeenAt === null) {
    return t("iot.devices.connectivity.never");
  }
  return t("iot.devices.connectivity.disconnected");
}

/** Last-seen line: relative time of the last state change, with fallbacks. */
export function useFormatLastSeen(): (connectivity: DeviceConnectivity | null) => string {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  return (connectivity: DeviceConnectivity | null) => {
    if (connectivity === null) {
      return t("iot.devices.connectivity.unknown");
    }
    if (connectivity.connected) {
      return connectivity.lastSeenAt === null
        ? t("iot.devices.connectivity.connectedNow")
        : t("iot.devices.connectivity.onlineSince", {
            time: formatDateTime(connectivity.lastSeenAt, locale),
          });
    }
    if (connectivity.lastSeenAt === null) {
      return t("iot.devices.connectivity.never");
    }
    return formatRelativeTime(connectivity.lastSeenAt, locale);
  };
}
