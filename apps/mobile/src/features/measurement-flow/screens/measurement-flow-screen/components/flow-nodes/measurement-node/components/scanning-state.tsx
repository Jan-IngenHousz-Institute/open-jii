import { clsx } from "clsx";
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import type { CommandProgress } from "~/features/connection/services/multispeq-communication/driver-command-executor";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface ScanningStateProps {
  protocolName?: string;
  /** Live transfer progress of the in-flight command, if any. */
  progress?: CommandProgress;
  /** Epoch ms the scan started — drives the elapsed-time readout. */
  scanStartedAt?: number;
  /** Estimated protocol runtime (ms), if known — sizes the progress bar. */
  estimatedMs?: number;
}

/** Format a duration as `m:ss`, or `Ns` under a minute. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Feedback shown while a measurement runs. A MultispeQ executes its protocol
 * silently and only returns a result at the very end, so there is no live
 * device signal to show mid-measurement. Instead we show elapsed time against
 * the protocol's estimated runtime (a moving bar that proves the app is still
 * waiting, and sets the user's expectation for a multi-minute curve), and
 * switch to a "receiving results" indicator once the reply starts streaming.
 */
export function ScanningState({
  protocolName,
  progress,
  scanStartedAt,
  estimatedMs,
}: ScanningStateProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");

  // Tick once a second so elapsed time advances even while the device is
  // silent — the timer, not a device event, is what proves liveness here.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!scanStartedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [scanStartedAt]);

  const elapsedMs = scanStartedAt ? Math.max(0, now - scanStartedAt) : 0;
  const isReceiving = progress?.phase === "receiving";
  const hasEstimate = estimatedMs !== undefined && estimatedMs > 0;
  const overEstimate = hasEstimate && elapsedMs > estimatedMs;
  // Cap just under full so the bar never reads "done" before the result lands.
  const fraction = hasEstimate ? Math.min(0.99, elapsedMs / estimatedMs) : undefined;

  const title = isReceiving
    ? t("measurementFlow:measurementNode.scanning.receiving")
    : overEstimate
      ? t("measurementFlow:measurementNode.scanning.takingLonger")
      : t("measurementFlow:measurementNode.scanning.title");

  const elapsedLabel = hasEstimate
    ? t("measurementFlow:measurementNode.scanning.elapsedOfEstimate", {
        elapsed: formatDuration(elapsedMs),
        estimate: formatDuration(estimatedMs),
      })
    : t("measurementFlow:measurementNode.scanning.elapsed", {
        elapsed: formatDuration(elapsedMs),
      });

  const chunks = progress?.chunks ?? 0;

  return (
    <View className="flex-1 items-center justify-center gap-3">
      <Text className={clsx("text-center text-xl font-bold", classes.text)}>{title}</Text>
      {protocolName && (
        <Text className={clsx("text-center text-base", classes.textMuted)}>{protocolName}</Text>
      )}

      <ActivityIndicator size="large" color={colors.brand} />

      <Text className={clsx("text-center text-sm", classes.textMuted)}>{elapsedLabel}</Text>

      {fraction !== undefined && (
        <View className="bg-muted h-1.5 w-48 overflow-hidden rounded-full">
          <View
            className="h-full rounded-full"
            style={{ width: `${Math.round(fraction * 100)}%`, backgroundColor: colors.brand }}
          />
        </View>
      )}

      {isReceiving && chunks > 0 && (
        <Text className={clsx("text-center text-xs", classes.textMuted)}>
          {t("measurementFlow:measurementNode.scanning.packets", { count: chunks })}
        </Text>
      )}
    </View>
  );
}
