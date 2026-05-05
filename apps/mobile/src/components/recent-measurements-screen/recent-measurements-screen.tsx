import { clsx } from "clsx";
import { ChevronsLeft, Download } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Button } from "~/components/Button";
import { MeasurementsModals } from "~/components/recent-measurements-screen/measurements-modals";
import type { ModalState } from "~/components/recent-measurements-screen/measurements-modals";
import { MeasurementsToolbar } from "~/components/recent-measurements-screen/measurements-toolbar";
import { SwipeableMeasurementRow } from "~/components/recent-measurements-screen/swipeable-measurement-row";
import { useRecentMeasurementsActions } from "~/components/recent-measurements-screen/use-recent-measurements-actions";
import type { MeasurementFilter, MeasurementItem } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";

export function RecentMeasurementsScreen() {
  const { colors, classes } = useTheme();
  const [filter, setFilter] = useState<MeasurementFilter>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const closeModal = useCallback(() => setModal({ kind: "none" }), []);

  const {
    measurements,
    hasAnyMeasurements,
    syncedCount,
    unsyncedCount,
    uploadingCount,
    isUploading,
    confirmSync,
    confirmDelete,
    confirmSyncAll,
    confirmDeleteAllSynced,
    handleExport,
    saveComment,
  } = useRecentMeasurementsActions(filter);

  const renderItem = ({ item }: { item: MeasurementItem }) => (
    <SwipeableMeasurementRow
      id={item.key}
      timestamp={item.timestamp}
      experimentName={item.experimentName}
      status={item.status}
      questions={item.questions}
      onPress={() => setModal({ kind: "questions", measurement: item })}
      onComment={
        item.status === "unsynced"
          ? () => setModal({ kind: "comment", measurement: item })
          : undefined
      }
      onDelete={() => confirmDelete(item)}
      onSync={item.status === "unsynced" ? () => confirmSync(item) : undefined}
    />
  );

  const hasItems = measurements.length > 0;

  return (
    <View className={clsx("flex-1", classes.background)}>
      <MeasurementsToolbar
        filter={filter}
        onFilterChange={setFilter}
        syncedCount={syncedCount}
        unsyncedCount={unsyncedCount}
        uploadingCount={uploadingCount}
        isUploading={isUploading}
        onSyncAll={confirmSyncAll}
        onDeleteAllSynced={confirmDeleteAllSynced}
      />

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
            <Text className={clsx("mt-2 text-center", classes.textMuted)}>
              {filter === "all"
                ? "Start measuring to see your data here"
                : filter === "synced"
                  ? "No synced measurements yet"
                  : "All measurements have been synced"}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="px-4 pt-4">
            <Button
              title="Export measurements"
              variant="tertiary"
              onPress={handleExport}
              isDisabled={!hasAnyMeasurements}
              icon={<Download size={16} color={colors.primary.dark} strokeWidth={1.4} />}
            />
          </View>
        }
      />

      <MeasurementsModals state={modal} onClose={closeModal} onSaveComment={saveComment} />
    </View>
  );
}
