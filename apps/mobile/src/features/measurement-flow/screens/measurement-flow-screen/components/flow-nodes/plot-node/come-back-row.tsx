import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { SkippedPlot } from "./next-plot";
import { PlotMarkGlyph } from "./plot-mark-glyph";

interface ComeBackRowProps {
  skipped: SkippedPlot[];
  onPress: () => void;
}

/** The Next plot step's line for the come-back-later list, opening the list on tap. */
export function ComeBackRow({ skipped, onPress }: ComeBackRowProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();

  const plots = skipped.map((plot) => plot.identifier).join(", ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="border-border bg-card flex-row items-center gap-3 rounded-xl border p-3 active:opacity-60"
    >
      <View className="bg-gray-background h-10 w-10 items-center justify-center rounded-xl">
        <PlotMarkGlyph mark="skipped" size={20} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-on-surface text-[15px] font-bold">
          {t("measurementFlow:comeBack.count", { count: skipped.length })}
        </Text>
        <Text className="text-muted-body text-[13px]">{plots}</Text>
      </View>
      <ChevronRight size={20} color={themeColors.inactive} />
    </Pressable>
  );
}
