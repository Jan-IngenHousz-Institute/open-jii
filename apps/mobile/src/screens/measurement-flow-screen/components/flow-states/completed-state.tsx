import { clsx } from "clsx";
import { ChevronsLeft } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { Button } from "~/components/Button";
import { TabBar } from "~/components/TabBar";
import { MeasurementsModals } from "~/components/recent-measurements-screen/measurements-modals";
import type { ModalState } from "~/components/recent-measurements-screen/measurements-modals";
import { SwipeableMeasurementRow } from "~/components/recent-measurements-screen/swipeable-measurement-row";
import { useRecentMeasurementsActions } from "~/components/recent-measurements-screen/use-recent-measurements-actions";
import type { MeasurementFilter, MeasurementItem } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { getCommentFromMeasurementResult } from "~/utils/measurement-annotations";

const TABS = [
  { key: "all", label: "All" },
  { key: "synced", label: "Synced" },
  { key: "unsynced", label: "Unsynced" },
];

type TabKey = (typeof TABS)[number]["key"];

export function CompletedState() {
  const { classes, colors } = useTheme();
  const [filter, setFilter] = useState<TabKey>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const closeModal = useCallback(() => setModal({ kind: "none" }), []);
  const { startNewIteration } = useMeasurementFlowStore();

  const { measurements, confirmSync, confirmDelete, saveComment } = useRecentMeasurementsActions(
    filter as MeasurementFilter,
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
        <TabBar tabs={TABS} activeTab={filter} onTabChange={setFilter} />
      </View>

      {hasItems && (
        <View className="flex-row items-center justify-end gap-1 px-4 pb-2">
          <ChevronsLeft size={13} color={colors.neutral.gray500} />
          <Text className={clsx("text-sm font-normal", classes.textMuted)}>Swipe</Text>
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
              No measurements found
            </Text>
            <Text className={clsx("mt-2 text-center text-sm", classes.textMuted)}>
              {filter === "all"
                ? "Your uploaded measurement will appear here"
                : filter === "synced"
                  ? "No synced measurements yet"
                  : "All measurements have been synced"}
            </Text>
          </View>
        }
      />

      <View className="px-4 py-3">
        <Button title="Start next measurement" onPress={startNewIteration} style={{ height: 44 }} />
      </View>

      <MeasurementsModals state={modal} onClose={closeModal} onSaveComment={saveComment} />
    </View>
  );
}
