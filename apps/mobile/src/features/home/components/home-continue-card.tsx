import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { useHomeContinueAction } from "~/features/home/hooks/use-home-continue-action";
import {
  useHasPausedFlow,
  usePausedFlowSnapshot,
} from "~/features/measurement-flow/stores/use-paused-flow-store";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function HomeContinueCard() {
  const hasPausedFlow = useHasPausedFlow();
  const snapshot = usePausedFlowSnapshot();
  const continueAction = useHomeContinueAction();
  const { t } = useTranslation("home");
  const colors = useThemeColors();

  if (!hasPausedFlow || !snapshot) return null;

  const total = Math.max(snapshot.totalSteps, 1);
  const step = Math.min(snapshot.currentFlowStep + 1, total);
  const progress = Math.min(Math.max((step - 1) / total, 0), 1);

  const stepLine = snapshot.plotLabel
    ? t("continue.stepOfTotalWithPlot", { step, total, plot: snapshot.plotLabel })
    : t("continue.stepOfTotal", { step, total });

  return (
    <Card
      tone="mint"
      className="border-jii-primary/15 dark:border-jii-primary-bright/40 dark:bg-jii-primary/25 border"
      style={{ padding: 16, marginTop: 0, marginBottom: 12 }}
    >
      <View className="flex-row items-center">
        <View className="bg-jii-primary dark:bg-jii-primary-bright mr-2 h-1.5 w-1.5 rounded-full" />
        <Text className="text-jii-darker-green dark:text-jii-primary-bright text-[11px] font-bold tracking-wider">
          {t("continue.inProgress")}
        </Text>
      </View>

      <Text
        className="text-on-surface mt-2"
        style={{ fontFamily: "Poppins-Bold", fontSize: 17, lineHeight: 22 }}
        numberOfLines={2}
      >
        {snapshot.experimentLabel}
      </Text>
      <Text className="text-muted-body mt-1 text-[13px]">{stepLine}</Text>

      <View className="bg-jii-primary/15 mt-3 h-1 overflow-hidden rounded-full dark:bg-white/10">
        <View
          className="bg-jii-primary dark:bg-jii-primary-bright h-full rounded-full"
          style={{ width: `${progress * 100}%` }}
        />
      </View>

      <Button
        title={t("continue.action")}
        onPress={continueAction}
        variant="primary"
        size="md"
        style={{ marginTop: 14, alignSelf: "flex-start" }}
        icon={<ChevronRight size={18} color={colors.onPrimary} />}
        iconPosition="right"
      />
    </Card>
  );
}
