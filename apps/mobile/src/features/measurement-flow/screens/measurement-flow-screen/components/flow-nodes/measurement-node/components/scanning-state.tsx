import { clsx } from "clsx";
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import type { DeviceScanState } from "~/features/connection/hooks/use-multi-scanner";
import type { DeviceCommandProgress } from "~/features/connection/services/device-command-executor";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { DeviceScanProgressList } from "./device-scan-progress-list";

interface ScanningStateProps {
  protocolName?: string;
  /** Per-device round state; more than one entry switches to the multi-scan list. */
  deviceStates?: DeviceScanState[];
  /** Live transfer progress of the in-flight command, if any. */
  progress?: DeviceCommandProgress;
  /** Epoch ms the scan started, drives the elapsed-time readout. */
  scanStartedAt?: number;
  /** Estimated protocol runtime (ms), if known, sizes the progress bar. */
  estimatedMs?: number;
  /** Protocol pauses for a physical open/close of the clamp (par_led gates). */
  requiresInteraction?: boolean;
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
 * very end, there is genuinely no mid-measurement device signal to surface.
 * This is confirmed two ways: the PhotosynQ protocol docs describe a single
 * round-trip (protocol in → silent run → one result burst), and our Bluetooth
 * Classic (BR/EDR) transport reads an SPP stream that is buffered into one
 * assembled message until `__EOM__`. So a "last signal Xs ago" readout would
 * just be elapsed time wearing a costume, there is nothing real to count.
 *
 * The honest progress signal is therefore time: a big, always-ticking elapsed
 * clock shown against the protocol's estimate. The activity line states plainly
 * that the device is working silently, and flips to "Receiving results…" the
 * moment the final reply burst lands. A multi-scan round adds a per-device
 * status list; the clock and estimate apply to the whole round (one protocol).
 */
export function ScanningState({
  protocolName,
  deviceStates,
  progress,
  scanStartedAt,
  estimatedMs,
  requiresInteraction,
}: ScanningStateProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const isMultiDevice = (deviceStates?.length ?? 0) > 1;

  // Tick once a second so the elapsed clock advances even while the device is
  // silent, the timer, not a device event, is what proves liveness here.
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
    : isMultiDevice
      ? t("measurementFlow:measurementNode.multiScan.scanningOnCount", {
          count: deviceStates?.length,
        })
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

      {isMultiDevice && deviceStates ? (
        <DeviceScanProgressList deviceStates={deviceStates} />
      ) : (
        <ActivityIndicator size="large" color={colors.brand} />
      )}

      {/* Total elapsed, the primary, always-visible clock. Tabular figures so
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

      {/* Interactive protocols pause for the user to open/close the clamp. The
          device gives no app-visible signal when it is waiting, so tell the user
          up front to follow the device's own prompts. */}
      {requiresInteraction && (
        <View className="bg-muted mt-2 max-w-xs rounded-lg p-3">
          <Text className={clsx("text-center text-sm font-semibold", classes.text)}>
            {t("measurementFlow:measurementNode.scanning.interactionTitle")}
          </Text>
          <Text className={clsx("mt-1 text-center text-xs leading-relaxed", classes.textMuted)}>
            {t("measurementFlow:measurementNode.scanning.interactionHint")}
          </Text>
        </View>
      )}
    </View>
  );
}
