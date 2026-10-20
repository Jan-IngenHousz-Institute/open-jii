import { Repeat2 } from "lucide-react-native";
import React from "react";
import { View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Tag } from "~/shared/ui/Tag";

interface RepeatMarkerProps {
  repeat: number;
  plot: string;
}

export function RepeatMarker({ repeat, plot }: RepeatMarkerProps) {
  const { t } = useTranslation("measurementFlow");

  return (
    <View className="mt-2 flex-row">
      <Tag variant="both" size="md" icon={<Repeat2 size={14} color={colors.jii.darkerGreen} />}>
        {t("measurementFlow:analysis.repeatMarker", { repeat, plot })}
      </Tag>
    </View>
  );
}
