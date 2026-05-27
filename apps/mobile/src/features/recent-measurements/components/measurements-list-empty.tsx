import React, { memo } from "react";
import { Text, View } from "react-native";
import type { MeasurementFilter } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useTranslation } from "~/shared/i18n";

interface Props {
  filter: MeasurementFilter;
}

export const MeasurementsListEmpty = memo(function MeasurementsListEmpty({ filter }: Props) {
  const { t } = useTranslation(["recentMeasurements"]);
  const hintKey =
    filter === "all"
      ? "recentMeasurements:list.emptyHintAll"
      : filter === "synced"
        ? "recentMeasurements:list.emptyHintSynced"
        : "recentMeasurements:list.emptyHintUnsynced";
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Text className="text-on-surface text-center text-lg">
        {t("recentMeasurements:list.emptyTitle")}
      </Text>
      <Text className="text-muted-body mt-2 text-center">{t(hintKey)}</Text>
    </View>
  );
});
