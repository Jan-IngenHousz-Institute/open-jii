import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { JoinCodeEntrySheet } from "~/features/experiments/components/join-code-entry-sheet";
import {
  FailureCard,
  ThrottledCard,
} from "~/features/experiments/components/join-code-failure-card";
import { JoinCodePreviewCard } from "~/features/experiments/components/join-code-preview-card";
import { parseJoinCodeInput } from "~/features/experiments/domain/join-code";
import { useRedeemJoinCode } from "~/features/experiments/hooks/use-redeem-join-code";
import { useResolveJoinCode } from "~/features/experiments/hooks/use-resolve-join-code";
import { apiErrorCode, isApiStatus } from "~/features/experiments/utils/api-error";
import { useTranslation } from "~/shared/i18n";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function JoinCodeScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const { t } = useTranslation(["common", "experiments"]);
  const entrySheetRef = useRef<BottomSheetModal>(null);

  const code = useMemo(() => parseJoinCodeInput(rawCode), [rawCode]);
  const { preview, isLoading, isPaused, error, errorUpdatedAt, refetch } = useResolveJoinCode(code);
  const { redeem, isPending } = useRedeemJoinCode(preview?.experiment.name ?? "");
  const { data: online } = useIsOnline();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("experiments:joinCode.screenTitle") });
  }, [navigation, t]);

  const openExperiment = (experimentId: string) => {
    router.replace({ pathname: "/discover/[id]", params: { id: experimentId } });
  };

  const body = () => {
    // Nothing worth a request: a typo, or a QR from somewhere else entirely.
    if (!code) {
      return (
        <FailureCard
          message={t("experiments:joinCode.notACode")}
          actionLabel={t("experiments:joinCode.enterDifferent")}
          onAction={() => entrySheetRef.current?.present()}
        />
      );
    }

    if (isApiStatus(error, 404)) {
      return (
        <FailureCard
          message={t(
            apiErrorCode(error) === "JOIN_CODE_EXPIRED"
              ? "experiments:joinCode.expired"
              : "experiments:joinCode.notFound",
          )}
          actionLabel={t("experiments:joinCode.tryAnother")}
          onAction={() => entrySheetRef.current?.present()}
        />
      );
    }

    if (isApiStatus(error, 403)) {
      return (
        <FailureCard
          message={t("experiments:joinCode.archived")}
          actionLabel={t("experiments:joinCode.tryAnother")}
          onAction={() => entrySheetRef.current?.present()}
        />
      );
    }

    if (isApiStatus(error, 429)) {
      // Retry only once the window is over, and never another code: the throttle
      // counts the caller, not the code, so another code is refused just the same.
      return <ThrottledCard throttledAt={errorUpdatedAt} onRetry={() => void refetch()} />;
    }

    if (!preview && (error || isPaused)) {
      return (
        <FailureCard
          message={t(
            isPaused && !error ? "experiments:joinCode.offline" : "experiments:joinCode.loadFailed",
          )}
          actionLabel={t("common:retry")}
          onAction={() => void refetch()}
        />
      );
    }

    if (isLoading || !preview) {
      return (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color={themeColors.brand} />
        </View>
      );
    }

    return (
      <JoinCodePreviewCard
        code={code}
        preview={preview}
        isJoining={isPending}
        isOffline={online === false}
        onOpen={() => openExperiment(preview.experiment.id)}
        onJoin={() =>
          redeem({ code }, { onSuccess: (result) => openExperiment(result.experimentId) })
        }
      />
    );
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {body()}
      <JoinCodeEntrySheet ref={entrySheetRef} />
    </ScrollView>
  );
}

export default JoinCodeScreen;
