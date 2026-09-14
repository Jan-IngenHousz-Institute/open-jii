import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import type { ResumeHydrationState } from "~/features/measurement-flow/hooks/use-resume-snapshot-hydration";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

type Reason = Extract<ResumeHydrationState, { status: "unavailable" }>["reason"];

const COPY: Record<Reason, { title: string; body: string }> = {
  offline: {
    title: "measurementFlow:flowStates.resumeUnavailable.titleOffline",
    body: "measurementFlow:flowStates.resumeUnavailable.bodyOffline",
  },
  "version-missing": {
    title: "measurementFlow:flowStates.resumeUnavailable.titleUnavailable",
    body: "measurementFlow:flowStates.resumeUnavailable.bodyVersionMissing",
  },
  error: {
    title: "measurementFlow:flowStates.resumeUnavailable.titleUnavailable",
    body: "measurementFlow:flowStates.resumeUnavailable.bodyError",
  },
};

// Exit opens the existing exit sheet (Pause / Discard). No Retry: the version
// query resumes on reconnect and clears the gate by itself.
export function ResumeUnavailableState({ reason }: { reason: Reason }) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const copy = COPY[reason];

  return (
    <View
      className={clsx("flex-1 justify-center rounded-t-3xl px-6", classes.card, classes.border)}
    >
      <Text className={clsx("mb-3 text-center text-lg font-semibold", classes.text)}>
        {t(copy.title)}
      </Text>
      <Text className={clsx("mb-6 text-center", classes.textSecondary)}>{t(copy.body)}</Text>
      <Button
        title={t("measurementFlow:flowStates.resumeUnavailable.exit")}
        onPress={() => useExitFlowSheetStore.getState().open()}
        variant="primary"
        size="md"
      />
    </View>
  );
}
