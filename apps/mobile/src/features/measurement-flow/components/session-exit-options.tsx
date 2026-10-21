import { CircleStop, Pause, Trash2 } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { LayoutSession } from "../screens/measurement-flow-screen/components/flow-nodes/plot-node/next-plot";
import { SessionExitOption } from "./session-exit-option";

interface SessionExitOptionsProps {
  session: LayoutSession;
  currentPlot: string;
  onPause: () => void;
  onEnd: () => void;
  onDiscardRound: () => void;
}

/** The exit sheet in an experiment with a layout, where leaving can mean the round or the session. */
export function SessionExitOptions({
  session,
  currentPlot,
  onPause,
  onEnd,
  onDiscardRound,
}: SessionExitOptionsProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();

  const hasSkippedPlots = session.skipped.length > 0;

  return (
    <>
      <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
        {t("sessionExit.title")}
      </Text>
      <Text className="text-muted-body text-[13.5px] leading-5">
        {hasSkippedPlots
          ? t("sessionExit.bodyWithSkipped", {
              measured: session.measured.length,
              total: session.total,
              count: session.skipped.length,
            })
          : t("sessionExit.body", { measured: session.measured.length, total: session.total })}
      </Text>

      <View className="gap-3">
        <SessionExitOption
          Icon={Pause}
          title={t("sessionExit.pause")}
          subtitle={t("sessionExit.pauseSub", { plot: currentPlot })}
          color={themeColors.brand}
          iconBackground={themeColors.brand + "30"}
          className="bg-jii-mint-light border-jii-mint"
          onPress={onPause}
        />
        <SessionExitOption
          Icon={CircleStop}
          title={t("sessionExit.end")}
          subtitle={t("sessionExit.endSub")}
          color={themeColors.onSurface}
          iconBackground={themeColors.grayBackground}
          className="border-border bg-card"
          onPress={onEnd}
        />
        <SessionExitOption
          Icon={Trash2}
          title={t("sessionExit.discardRound")}
          subtitle={t("sessionExit.discardRoundSub", { plot: currentPlot })}
          color={colors.semantic.error}
          iconBackground="#fee2e2"
          className="border-error/40 bg-card"
          onPress={onDiscardRound}
        />
      </View>
    </>
  );
}
