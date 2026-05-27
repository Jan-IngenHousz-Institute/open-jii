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
import { getMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { TabBar } from "~/shared/ui/TabBar";
import { useTheme } from "~/shared/ui/hooks/use-theme";

type TabKey = "all" | "synced" | "unsynced";

export function CompletedState() {
  const { classes, colors } = useTheme();
  const { t } = useTranslation(["common", "measurementFlow"]);
  const [filter, setFilter] = useState<TabKey>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const closeModal = useCallback(() => setModal({ kind: "none" }), []);
  const { startNewIteration } = useMeasurementFlowStore();

  const {
    measurements,
    confirmSync,
    confirmDelete,
    saveComment,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecentMeasurementsActions(filter as MeasurementFilter);

  const openModal = useCallback(async (kind: "questions" | "comment", id: string) => {
    const full = await getMeasurement(id);
    if (full) setModal({ kind, measurement: full });
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
      onPress={() => void openModal("questions", item.key)}
      onComment={
        item.status === "pending" || item.status === "failed"
          ? () => void openModal("comment", item.key)
          : undefined
      }
      onDelete={() => {
        if (item.status === "uploading") return;
        confirmDelete(item);
      }}
      onSync={
        item.status === "pending" || item.status === "failed" ? () => confirmSync(item) : undefined
      }
      hasComment={item.hasComment}
    />
  );

  const hasItems = measurements.length > 0;

  return (
    <View className="flex-1">
      <View className="px-4 pt-2">
        <TabBar
          variant="underline"
          tabs={tabs}
          activeTab={filter}
          onTabChange={setFilter}
          trailing={
            hasItems ? (
              <View className="flex-row items-center gap-1">
                <ChevronsLeft size={13} color={colors.neutral.gray500} />
                <Text className={clsx("text-xs font-normal", classes.textMuted)}>
                  {t("measurementFlow:flowStates.completed.swipeHint")}
                </Text>
              </View>
            ) : null
          }
        />
      </View>

      <FlatList
        data={measurements}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 16, flexGrow: 1 }}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
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
