import { Download } from "lucide-react-native";
import React, { memo } from "react";
import { View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface Props {
  onExport: () => void;
  isDisabled: boolean;
}

export const MeasurementsListFooter = memo(function MeasurementsListFooter({
  onExport,
  isDisabled,
}: Props) {
  const { t } = useTranslation(["recentMeasurements"]);
  const { colors } = useTheme();
  return (
    <View className="px-4 pt-4">
      <Button
        title={t("recentMeasurements:list.exportButton")}
        variant="tertiary"
        onPress={onExport}
        isDisabled={isDisabled}
        icon={<Download size={16} color={colors.brand} strokeWidth={1.4} />}
      />
    </View>
  );
});
