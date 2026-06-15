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
  // Floor (not round) so the clock never reads ahead of the real elapsed time.
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Feedback shown while a measurement runs.
 *
 * A MultispeQ executes its protocol SILENTLY and only returns a result at the
 * very end — there is genuinely no mid-measurement device signal to surface.
 * This is confirmed two ways: the PhotosynQ protocol docs describe a single
 * round-trip (protocol in → silent run → one result burst), and our BLE
 * transport only delivers one assembled message (it buffers every notification
 * until `__EOM__`). So a "last signal Xs ago" readout would just be elapsed
 * time wearing a costume — there is nothing real to count.
 *
 * The honest progress signal is therefore time: a big, always-ticking elapsed
 * clock shown against the protocol's estimate. The activity line states plainly
 * that the device is working silently, and flips to "Receiving results…" the
 * moment the final reply burst lands.
 */
export function ScanningState({
  protocolName,
  progress,
  scanStartedAt,
  estimatedMs,
}: ScanningStateProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");

  // Tick once a second so the elapsed clock advances even while the device is
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

  const title = overEstimate
    ? t("measurementFlow:measurementNode.scanning.takingLonger")
    : t("measurementFlow:measurementNode.scanning.title");

  // The MultispeQ stays silent until the protocol finishes, so until the final
  // reply lands the only honest status is "measuring"; it flips to "receiving"
  // the instant the result burst arrives.
  const activityLabel = isReceiving
    ? t("measurementFlow:measurementNode.scanning.receiving")
    : t("measurementFlow:measurementNode.scanning.measuring");

  return (
    <View className="flex-1 items-center justify-center gap-3">
      <Text className={clsx("text-center text-xl font-bold", classes.text)}>{title}</Text>
      {protocolName && (
        <Text className={clsx("text-center text-base", classes.textMuted)}>{protocolName}</Text>
      )}

      <ActivityIndicator size="large" color={colors.brand} />

      {/* Total elapsed — the primary, always-visible clock. Tabular figures so
          the width doesn't jitter as the digits tick. */}
      <Text
        className={clsx("text-center text-4xl font-bold", classes.text)}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {formatDuration(elapsedMs)}
      </Text>
      {hasEstimate && (
        <Text className={clsx("text-center text-sm", classes.textMuted)}>
          {t("measurementFlow:measurementNode.scanning.expected", {
            estimate: formatDuration(estimatedMs),
          })}
        </Text>
      )}

      {fraction !== undefined && (
        <View className="bg-muted h-1.5 w-48 overflow-hidden rounded-full">
          <View
            className="h-full rounded-full"
            style={{ width: `${Math.round(fraction * 100)}%`, backgroundColor: colors.brand }}
          />
        </View>
      )}

      {/* Secondary: plainly states the device is silent, flips to "receiving". */}
      <Text className={clsx("text-center text-xs", classes.textMuted)}>{activityLabel}</Text>
    </View>
  );
}
