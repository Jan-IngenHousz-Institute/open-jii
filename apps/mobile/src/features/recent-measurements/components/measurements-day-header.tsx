import React, { memo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import type { MeasurementDaySection } from "~/features/recent-measurements/utils/group-measurements-by-day";

interface Props {
  section: MeasurementDaySection;
}

export const MeasurementsDayHeader = memo(function MeasurementsDayHeader({ section }: Props) {
  const { t } = useTranslation(["recentMeasurements"]);
  const i18nKey =
    section.kind === "today"
      ? "recentMeasurements:sectionHeader.today"
      : section.kind === "yesterday"
        ? "recentMeasurements:sectionHeader.yesterday"
        : "recentMeasurements:sectionHeader.other";
  return (
    <View className="bg-background px-4 pb-1.5 pt-3">
      <Text
        className="text-muted-body text-[12px] font-bold uppercase"
        style={{ letterSpacing: 0.6 }}
      >
        {t(i18nKey, { date: section.dateLabel })}
      </Text>
    </View>
  );
});
