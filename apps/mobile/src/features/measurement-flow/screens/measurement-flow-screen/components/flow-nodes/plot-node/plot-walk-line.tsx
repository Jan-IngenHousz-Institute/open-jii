import { Route } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { ExampleWalk } from "./next-plot";

interface PlotWalkLineProps {
  walk: ExampleWalk;
}

/** The plot's place in the measurer's walk, the plot after it, and why the order is what it is. */
export function PlotWalkLine({ walk }: PlotWalkLineProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <Route size={16} color={themeColors.brand} />
        <Text className="text-sm font-semibold" style={{ color: themeColors.brand }}>
          {t("measurementFlow:plotNode.walkPlace", { position: walk.position, total: walk.total })}
        </Text>
        <View className="bg-inactive h-1 w-1 rounded-full" />
        <Text className="text-muted-foreground text-sm">
          {t("measurementFlow:plotNode.walkNext", { plots: walk.after(1).join(", ") })}
        </Text>
      </View>
      <Text className="text-muted-foreground text-sm">{t("measurementFlow:plotNode.walkWhy")}</Text>
    </View>
  );
}
