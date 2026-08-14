"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { intervalToDuration } from "date-fns";

import type { DeviceMonitoring, DeviceSession } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

interface SessionStripProps {
  monitoring: DeviceMonitoring;
  from: string;
  to: string;
}

// Compact, locale-neutral duration notation ("2d 4h", "3h 15m", "45m").
function formatDuration(seconds: number): string {
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  const days = (duration.days ?? 0) + (duration.months ?? 0) * 30 + (duration.years ?? 0) * 365;

  if (days > 0) {
    return `${String(days)}d ${String(duration.hours ?? 0)}h`;
  }
  if ((duration.hours ?? 0) > 0) {
    return `${String(duration.hours ?? 0)}h ${String(duration.minutes ?? 0)}m`;
  }
  return `${String(duration.minutes ?? 0)}m`;
}

/**
 * Connectivity over the range as one horizontal band: green segments are
 * online sessions, the gray track is offline or unknown time. Interval data
 * gets an interval form, not a line chart.
 */
export function SessionStrip({ monitoring, from, to }: SessionStripProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const rangeStart = new Date(from).getTime();
  const rangeEnd = Math.min(Date.now(), new Date(to).getTime());
  const rangeMs = Math.max(1, rangeEnd - rangeStart);

  const segments = monitoring.sessions.map((session) => {
    const start = Math.max(rangeStart, new Date(session.start).getTime());
    const end = session.end === null ? rangeEnd : new Date(session.end).getTime();
    return {
      session,
      leftPct: ((start - rangeStart) / rangeMs) * 100,
      widthPct: Math.max(0.4, ((end - start) / rangeMs) * 100),
    };
  });

  const reasonCounts = new Map<string, number>();
  for (const session of monitoring.sessions) {
    if (session.disconnectReason !== null) {
      reasonCounts.set(
        session.disconnectReason,
        (reasonCounts.get(session.disconnectReason) ?? 0) + 1,
      );
    }
  }
  const topReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const sessionLabel = (session: DeviceSession) => {
    const started = session.openStart
      ? t("iot.devices.monitoring.beforeRange")
      : formatRelativeTime(session.start, locale);
    const ended =
      session.end === null
        ? t("iot.devices.monitoring.stillConnected")
        : formatRelativeTime(session.end, locale);
    return { started, ended };
  };

  return (
    <div className="space-y-3">
      <TooltipProvider>
        <div className="bg-muted relative h-6 w-full overflow-hidden rounded-md">
          {segments.map((segment, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  role="img"
                  // Focusable so the tooltip's detail opens from the keyboard too.
                  tabIndex={0}
                  aria-label={t("iot.devices.monitoring.sessionAria", {
                    duration: formatDuration(segment.session.durationSeconds),
                  })}
                  className="absolute inset-y-0 rounded-sm bg-emerald-500/90 hover:bg-emerald-600"
                  style={{
                    left: `${String(segment.leftPct)}%`,
                    width: `${String(segment.widthPct)}%`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent className="space-y-0.5 text-xs">
                <p>
                  {t("iot.devices.monitoring.sessionStarted")}:{" "}
                  {sessionLabel(segment.session).started}
                </p>
                <p>
                  {t("iot.devices.monitoring.sessionEnded")}: {sessionLabel(segment.session).ended}
                </p>
                <p>
                  {t("iot.devices.monitoring.sessionDuration")}:{" "}
                  {formatDuration(segment.session.durationSeconds)}
                </p>
                {segment.session.disconnectReason !== null && (
                  <p className="font-mono">{segment.session.disconnectReason}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {topReasons.length > 0 && (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="font-medium">{t("iot.devices.monitoring.disconnectReasons")}:</span>
          {topReasons.map(([reason, count]) => (
            <span key={reason} className="font-mono">
              {reason} ×{count}
            </span>
          ))}
        </div>
      )}

      {monitoring.truncated && (
        <p className="text-muted-foreground text-xs">{t("iot.devices.monitoring.truncated")}</p>
      )}
    </div>
  );
}
