import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { Clock } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { ExperimentJoinRequestSheet } from "~/features/experiments/components/experiment-join-request-sheet";
import { JoinCodeEntrySheet } from "~/features/experiments/components/join-code-entry-sheet";
import { canStartMeasuring } from "~/features/experiments/domain/start-measuring";
import { useCancelMyExperimentJoinRequest } from "~/features/experiments/hooks/use-cancel-my-experiment-join-request";
import { useMyExperimentJoinRequest } from "~/features/experiments/hooks/use-my-experiment-join-request";
import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Banner } from "~/shared/ui/Banner";
import { Button } from "~/shared/ui/Button";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type {
  ExperimentMembershipStatus,
  ExperimentStatus,
} from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentJoinCtaProps {
  id: string;
  name: string;
  status: ExperimentStatus;
  workbookVersionId: string | null;
  membershipStatus: ExperimentMembershipStatus;
  /** Called when the pending request turns out to have been decided elsewhere. */
  onRefreshAccess: () => void;
}

export function ExperimentJoinCta({
  id,
  name,
  status,
  workbookVersionId,
  membershipStatus,
  onRefreshAccess,
}: ExperimentJoinCtaProps) {
  const { t } = useTranslation(["common", "experiments"]);
  const { warningFg } = useThemeColors();
  const { data: online } = useIsOnline();
  const isOffline = online === false;
  const requestSheetRef = useRef<BottomSheetModal>(null);
  const codeSheetRef = useRef<BottomSheetModal>(null);
  const flowExperimentId = useMeasurementFlowStore((s) => s.experimentId);
  const isPending = membershipStatus === "pending_request";
  const { requestId, isNone } = useMyExperimentJoinRequest(id, { enabled: isPending });
  const { cancelRequest, isPending: isCancelling } = useCancelMyExperimentJoinRequest();

  // The request was decided while this screen was open: ask for the real state
  // rather than leaving a Cancel button with nothing to cancel. Once per
  // experiment, so a server that keeps answering 404 cannot spin the read.
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isPending || !isNone || refreshedFor.current === id) return;
    refreshedFor.current = id;
    onRefreshAccess();
  }, [isPending, isNone, id, onRefreshAccess]);

  // Archived is decided by the screen, which shows a banner in place of every
  // action. Guarding here too keeps the CTA honest wherever it is rendered.
  if (status === "archived") return null;

  if (membershipStatus === "member") {
    const verdict = canStartMeasuring({ status, workbookVersionId }, flowExperimentId);

    if (!verdict.ok && verdict.reason === "flow-in-progress") {
      return (
        <View className="mt-3">
          <Banner
            variant="yellow"
            title={t("experiments:detail.flowInProgress")}
            icon={<Clock size={18} color={warningFg} />}
            actionLabel={t("experiments:detail.flowInProgressAction")}
            // Deliberately no selection change: the running flow owns it.
            onAction={() => router.push("/measurement-flow")}
          />
        </View>
      );
    }

    const noWorkbook = !verdict.ok && verdict.reason === "no-workbook";
    const startMeasuring = () => {
      useExperimentSelectionStore.getState().setSelectedExperimentId(id);
      router.push("/measurement-flow");
    };

    return (
      <View className="mt-3 gap-2">
        <Button
          title={t("experiments:detail.startMeasuring")}
          onPress={startMeasuring}
          isDisabled={noWorkbook}
          size="lg"
        />
        {noWorkbook ? (
          <Text className="text-muted-body text-center text-[12px]">
            {t("experiments:detail.noWorkbook")}
          </Text>
        ) : null}
      </View>
    );
  }

  if (isPending) {
    const confirmCancel = () => {
      if (!requestId) return;
      showAlert(
        t("experiments:join.cancelConfirmTitle"),
        t("experiments:join.cancelConfirmBody", { name }),
        [
          {
            text: t("experiments:join.cancel"),
            variant: "danger",
            onPress: () => cancelRequest({ id, requestId }),
          },
          { text: t("common:cancel"), variant: "ghost" },
        ],
      );
    };

    return (
      <View className="mt-3 gap-2">
        <Banner
          variant="yellow"
          title={t("experiments:join.pending")}
          icon={<Clock size={18} color={warningFg} />}
        />
        <Button
          title={t("experiments:join.cancel")}
          onPress={confirmCancel}
          variant="light"
          isDisabled={isOffline || isCancelling || !requestId}
          isLoading={isCancelling}
        />
        {isOffline ? (
          <Text className="text-muted-body text-center text-[12px]">
            {t("experiments:join.offlineHint")}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="mt-3 gap-2">
      <Button
        title={t("experiments:join.cta")}
        onPress={() => requestSheetRef.current?.present()}
        isDisabled={isOffline}
        size="lg"
      />
      {isOffline ? (
        <Text className="text-muted-body text-center text-[12px]">
          {t("experiments:join.offlineHint")}
        </Text>
      ) : null}
      <Pressable
        onPress={() => codeSheetRef.current?.present()}
        accessibilityRole="button"
        className="items-center py-2 active:opacity-60"
      >
        <Text className="text-primary text-[13px]">{t("experiments:join.haveCode")}</Text>
      </Pressable>
      <ExperimentJoinRequestSheet ref={requestSheetRef} experimentId={id} experimentName={name} />
      <JoinCodeEntrySheet ref={codeSheetRef} />
    </View>
  );
}
