import { clsx } from "clsx";
import { ChevronsLeft } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { MeasurementsModals } from "~/features/recent-measurements/components/measurements-modals";
import type { ModalState } from "~/features/recent-measurements/components/measurements-modals";
import { SwipeableMeasurementRow } from "~/features/recent-measurements/components/swipeable-measurement-row";
import type {
  MeasurementFilter,
  MeasurementItem,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { useRecentMeasurementsActions } from "~/features/recent-measurements/hooks/use-recent-measurements-actions";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { TabBar } from "~/shared/ui/TabBar";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { getCommentFromMeasurementResult } from "~/shared/utils/measurement-annotations";

type TabKey = "all" | "synced" | "unsynced";

export function CompletedState() {
  const { classes, colors } = useTheme();
  const { t } = useTranslation(["common", "measurementFlow"]);
  const [filter, setFilter] = useState<TabKey>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const closeModal = useCallback(() => setModal({ kind: "none" }), []);
  const { startNewIteration } = useMeasurementFlowStore();

  const { measurements, confirmSync, confirmDelete, saveComment } = useRecentMeasurementsActions(
    filter as MeasurementFilter,
  );

  const tabs = useMemo<{ key: TabKey; label: string }[]>(
    () => [
      { key: "all", label: t("measurementFlow:flowStates.completed.tabs.all") },
      { key: "synced", label: t("measurementFlow:flowStates.completed.tabs.synced") },
      { key: "unsynced", label: t("measurementFlow:flowStates.completed.tabs.unsynced") },
    ],
    [t],
  );

  const renderItem = ({ item }: { item: MeasurementItem }) => (
    <SwipeableMeasurementRow
      id={item.key}
      timestamp={item.timestamp}
      experimentName={item.experimentName}
      status={item.status}
      questions={item.questions}
      onPress={() => setModal({ kind: "questions", measurement: item })}
      onComment={
        item.status === "pending" || item.status === "failed"
          ? () => setModal({ kind: "comment", measurement: item })
          : undefined
      }
      onDelete={() => {
        if (item.status === "uploading") return;
        confirmDelete(item);
      }}
      onSync={
        item.status === "pending" || item.status === "failed" ? () => confirmSync(item) : undefined
      }
      hasComment={
        !!getCommentFromMeasurementResult(item.data.measurementResult as Record<string, unknown>)
      }
    />
  );

  const hasItems = measurements.length > 0;

  return (
    <View className="flex-1">
      <View className="py-4">
        <TabBar tabs={tabs} activeTab={filter} onTabChange={setFilter} />
      </View>

      {hasItems && (
        <View className="flex-row items-center justify-end gap-1 px-4 pb-2">
          <ChevronsLeft size={13} color={colors.neutral.gray500} />
          <Text className={clsx("text-sm font-normal", classes.textMuted)}>
            {t("measurementFlow:flowStates.completed.swipeHint")}
          </Text>
        </View>
      )}

      <FlatList
        data={measurements}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 16, flexGrow: 1 }}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-4">
            <Text className={clsx("text-center text-lg", classes.textSecondary)}>
              {t("measurementFlow:flowStates.completed.noMeasurements")}
            </Text>
            <Text className={clsx("mt-2 text-center text-sm", classes.textMuted)}>
              {filter === "all"
                ? t("measurementFlow:flowStates.completed.emptyAll")
                : filter === "synced"
                  ? t("measurementFlow:flowStates.completed.emptySynced")
                  : t("measurementFlow:flowStates.completed.emptyUnsynced")}
            </Text>
          </View>
        }
      />

      <View className="px-4 py-3">
        <Button
          title={t("measurementFlow:flowStates.completed.startNext")}
          onPress={startNewIteration}
          style={{ height: 44 }}
        />
      </View>

      <MeasurementsModals state={modal} onClose={closeModal} onSaveComment={saveComment} />
    </View>
  );
}
