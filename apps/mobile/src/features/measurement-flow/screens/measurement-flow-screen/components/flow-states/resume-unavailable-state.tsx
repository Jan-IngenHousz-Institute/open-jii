import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

// Exit opens the existing exit sheet (Pause / Discard).
export function ResumeUnavailableState() {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");

  return (
    <View
      className={clsx("flex-1 justify-center rounded-t-3xl px-6", classes.card, classes.border)}
    >
      <Text className={clsx("mb-3 text-center text-lg font-semibold", classes.text)}>
        {t("measurementFlow:flowStates.resumeUnavailable.title")}
      </Text>
      <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
        {t("measurementFlow:flowStates.resumeUnavailable.body")}
      </Text>
      <Button
        title={t("measurementFlow:flowStates.resumeUnavailable.exit")}
        onPress={() => useExitFlowSheetStore.getState().open()}
        variant="primary"
        size="md"
      />
    </View>
  );
}
