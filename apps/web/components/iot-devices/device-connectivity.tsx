"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDateTime, formatRelativeTime } from "@/util/date";

import type { DeviceConnectivity } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface ConnectivityDotProps {
  connectivity: DeviceConnectivity | null;
  /** Lets a caller scale the label, e.g. the monitoring metric tiles. */
  className?: string;
}

/** Broker connectivity: green = connected, gray = offline, muted ring = unknown. */
export function ConnectivityDot({ connectivity, className }: ConnectivityDotProps) {
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
          "inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400",
          className,
        )}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        {t("iot.devices.connectivity.connected")}
      </span>
    );
  }

  return (
    <span
      className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-xs", className)}
    >
      <span className="bg-border h-2 w-2 shrink-0 rounded-full" />
      {t("iot.devices.connectivity.disconnected")}
    </span>
  );
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
