import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { JoinCodeEntrySheet } from "~/features/experiments/components/join-code-entry-sheet";
import { JoinCodePreviewCard } from "~/features/experiments/components/join-code-preview-card";
import { parseJoinCodeInput } from "~/features/experiments/domain/join-code";
import { useRedeemJoinCode } from "~/features/experiments/hooks/use-redeem-join-code";
import { useResolveJoinCode } from "~/features/experiments/hooks/use-resolve-join-code";
import { isApiStatus } from "~/features/experiments/utils/api-error";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

function serverMessage(error: unknown): string | undefined {
  return error instanceof Error && error.message.length > 0 ? error.message : undefined;
}

export function JoinCodeScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const { t } = useTranslation(["common", "experiments"]);
  const entrySheetRef = useRef<BottomSheetModal>(null);

  const code = useMemo(() => parseJoinCodeInput(rawCode), [rawCode]);
  const { preview, isLoading, isPaused, error, refetch } = useResolveJoinCode(code);
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
          // The server distinguishes "never existed" from "expired or revoked";
          // its copy is more specific than anything derivable here.
          message={serverMessage(error) ?? t("experiments:joinCode.notFound")}
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
      // No second chance offered: the throttle counts the caller, not the code,
      // so another code is refused just the same.
      return <FailureCard message={t("experiments:joinCode.tooMany")} />;
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

interface FailureCardProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

function FailureCard({ message, actionLabel, onAction }: FailureCardProps) {
  return (
    <Card padded>
      <Text className="text-on-surface text-center text-[14px] leading-5">{message}</Text>
      {actionLabel && onAction ? (
        <View className="mt-4">
          <Button title={actionLabel} onPress={onAction} variant="light" />
        </View>
      ) : null}
    </Card>
  );
}

export default JoinCodeScreen;
