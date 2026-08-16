"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";

import type { DeviceConnectivity } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface ConnectivityDotProps {
  connectivity: DeviceConnectivity | null;
  /** Lets a caller scale the label, e.g. the monitoring metric tiles. */
  className?: string;
}

/**
 * Broker connectivity as its own visual axis, separate from the credential
 * status badge: green = connected now, gray = offline, muted ring = unknown
 * (fleet index unavailable or still building).
 */
export function ConnectivityDot({ connectivity, className }: ConnectivityDotProps) {
  const { t } = useTranslation("iot");

  if (connectivity === null) {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-xs text-[#68737B]", className)}
        title={t("iot.devices.connectivity.unknown")}
      >
        <span className="h-2 w-2 rounded-full border border-dashed border-[#CDD5DB]" />
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
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-[#68737B]", className)}>
      <span className="h-2 w-2 shrink-0 rounded-full bg-[#CDD5DB]" />
      {t("iot.devices.connectivity.disconnected")}
    </span>
  );
}

/**
 * Human last-seen line for a device: relative time of the last connectivity
 * state change, "connected now" while online, and honest fallbacks for unknown
 * and never-connected states.
 */
export function useFormatLastSeen(): (connectivity: DeviceConnectivity | null) => string {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  return (connectivity: DeviceConnectivity | null) => {
    if (connectivity === null) {
      return t("iot.devices.connectivity.unknown");
    }
    if (connectivity.connected) {
      return t("iot.devices.connectivity.connectedNow");
    }
    if (connectivity.lastSeenAt === null) {
      return t("iot.devices.connectivity.never");
    }
    return formatRelativeTime(connectivity.lastSeenAt, locale);
  };
}
