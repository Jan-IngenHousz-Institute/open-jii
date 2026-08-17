import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useMacroOutputs } from "~/features/measurement-flow/hooks/use-macro-outputs";
import { useMeasurementMacroPreview } from "~/features/recent-measurements/hooks/use-measurement-macro-preview";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { MeasurementResult } from "~/shared/ui/measurement/measurement-result";

interface Props {
  measurement: StoredMeasurement;
  /** The sheet is open: only then is the macro fetched and re-run. */
  enabled: boolean;
}

/**
 * Re-runs a stored measurement's macro on open and shows the same result view
 * the analysis step shows right after a protocol + macro round.
 */
export function MeasurementMacroPreview({ measurement, enabled }: Props) {
  const colors = useThemeColors();
  const { t } = useTranslation(["recentMeasurements"]);
  const state = useMeasurementMacroPreview(measurement, enabled);
  const preview = state.status === "ready" ? state.preview : undefined;

  const { outputs, isLoading, error } = useMacroOutputs({
    rawMeasurement: preview?.rawMeasurement,
    macro: preview?.macro,
    ctx: preview?.ctx,
    enabled: enabled && !!preview,
  });

  // A measurement with no macro to re-run shows no section at all, rather than
  // an empty heading over a permanent placeholder.
  if (state.status === "unavailable" && state.blocker === "no-macro") return null;

  return (
    <View className="mt-6 gap-2">
      <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
        {t("recentMeasurements:macroPreview.heading")}
      </Text>

      {state.status === "loading" && (
        <View className="items-center py-6">
          <ActivityIndicator color={colors.brand} />
        </View>
      )}

      {state.status === "unavailable" && (
        <View className="bg-surface border-border rounded-xl border px-3 py-3">
          <Text className="text-muted-foreground text-sm">
            {t(`recentMeasurements:macroPreview.${state.blocker}`)}
          </Text>
        </View>
      )}

      {preview && (
        <MeasurementResult
          rawMeasurement={preview.rawMeasurement}
          outputs={outputs}
          isLoading={isLoading}
          error={error}
        />
      )}
    </View>
  );
}
