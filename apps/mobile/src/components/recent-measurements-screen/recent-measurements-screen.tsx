import { clsx } from "clsx";
import { ChevronsLeft, UploadCloud, Trash2, Download } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { toast } from "sonner-native";
import { showAlert } from "~/components/AlertDialog";
import { Button } from "~/components/Button";
import { TabBar } from "~/components/TabBar";
import { CommentModal } from "~/components/recent-measurements-screen/comment-modal";
import { MeasurementQuestionsModal } from "~/components/recent-measurements-screen/measurement-questions-modal";
import { SwipeableMeasurementRow } from "~/components/recent-measurements-screen/swipeable-measurement-row";
import { useAllMeasurements } from "~/hooks/use-all-measurements";
import type {
  MeasurementFilter,
  MeasurementItem as MeasurementItemType,
} from "~/hooks/use-all-measurements";
import { useMeasurements } from "~/hooks/use-measurements";
import { useTheme } from "~/hooks/use-theme";
import { exportMeasurementsToFile } from "~/services/export-measurements";
import { getCommentFromMeasurementResult } from "~/utils/measurement-annotations";

const TABS = [
  { key: "all", label: "All" },
  { key: "synced", label: "Synced" },
  { key: "unsynced", label: "Unsynced" },
];

type TabKey = (typeof TABS)[number]["key"];

export function RecentMeasurementsScreen() {
  const { colors, classes } = useTheme();
  const [filter, setFilter] = useState<TabKey>("all");
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementItemType | null>(null);
  const [selectedForComment, setSelectedForComment] = useState<MeasurementItemType | null>(null);
  const { measurements, uploadingCount, invalidate } = useAllMeasurements(filter as MeasurementFilter);
  const {
    uploadAll,
    isUploading,
    uploadOne,
    removeMeasurement,
    clearSyncedMeasurements,
    updateMeasurementComment,
  } = useMeasurements();

  // Ref holding all unstable values so useCallback handlers below need no deps.
  // Safe to update synchronously in render body since these are only read in event handlers.
  const cbRef = useRef({
    measurements,
    uploadOne,
    invalidate,
    removeMeasurement,
    setSelectedMeasurement,
    setSelectedForComment,
  });
  cbRef.current = {
    measurements,
    uploadOne,
    invalidate,
    removeMeasurement,
    setSelectedMeasurement,
    setSelectedForComment,
  };

  const handleItemPress = useCallback((id: string) => {
    const m = cbRef.current.measurements.find((m) => m.key === id);
    if (m) cbRef.current.setSelectedMeasurement(m);
  }, []);

  const handleComment = useCallback((id: string) => {
    const m = cbRef.current.measurements.find((m) => m.key === id);
    if (m) cbRef.current.setSelectedForComment(m);
  }, []);

  const handleSync = useCallback((id: string) => {
    const m = cbRef.current.measurements.find((m) => m.key === id);
    if (!m) return;
    showAlert("Upload Measurement", `Are you sure you want to upload "${m.experimentName}"?`, [
      {
        text: "Upload",
        variant: "primary",
        onPress: () => {
          void (async () => {
            await cbRef.current.uploadOne(id);
            cbRef.current.invalidate();
          })();
        },
      },
      { text: "Cancel", variant: "ghost" },
    ]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    const m = cbRef.current.measurements.find((m) => m.key === id);
    if (!m) return;
    const isSynced = m.status === "synced";
    const message = isSynced
      ? `Are you sure you want to delete "${m.experimentName}" from local storage?`
      : `Are you sure you want to remove "${m.experimentName}"? This will delete it from local storage.`;
    showAlert(isSynced ? "Delete Measurement" : "Remove Measurement", message, [
      {
        text: isSynced ? "Delete" : "Remove",
        variant: "danger",
        onPress: () => {
          void (async () => {
            try {
              await cbRef.current.removeMeasurement(id);
              cbRef.current.invalidate();
            } catch {
              toast.error("Failed to delete measurement. Please try again.");
            }
          })();
        },
      },
      { text: "Cancel", variant: "ghost" },
    ]);
  }, []);

  const renderItem = useCallback(
    ({ item: measurement }: { item: MeasurementItemType }) => (
      <SwipeableMeasurementRow
        id={measurement.key}
        timestamp={measurement.timestamp}
        experimentName={measurement.experimentName}
        status={measurement.status}
        questions={measurement.questions}
        onPress={handleItemPress}
        onComment={measurement.status === "unsynced" ? handleComment : undefined}
        onDelete={handleDelete}
        onSync={measurement.status === "unsynced" ? handleSync : undefined}
      />
    ),
    [handleItemPress, handleComment, handleDelete, handleSync],
  );

  const handleSyncAll = () => {
    showAlert(
      "Upload All Measurements",
      `Are you sure you want to sync ${unsyncedCount} unsynced measurement${unsyncedCount !== 1 ? "s" : ""}?`,
      [
        {
          text: "Upload All",
          variant: "primary",
          onPress: () => {
            void (async () => {
              try {
                await uploadAll();
                toast.success("All measurements synced successfully");
                invalidate();
              } catch {
                toast.error("Sync failed. Please try again.");
              }
            })();
          },
        },
        { text: "Cancel", variant: "ghost" },
      ],
    );
  };

  const handleDeleteAllSynced = () => {
    showAlert(
      "Delete all synced measurements",
      `Are you sure you want to delete all ${syncedCount} synced measurements from local storage?`,
      [
        {
          text: "Delete",
          variant: "danger",
          onPress: () => {
            clearSyncedMeasurements()
              .then(() => invalidate())
              .catch(() => toast.error("Failed to delete synced measurements"));
          },
        },
        { text: "Cancel", variant: "ghost" },
      ],
    );
  };

  const unsyncedCount = measurements?.filter((m) => m.status === "unsynced").length ?? 0;
  const syncedCount = measurements?.filter((m) => m.status === "synced").length ?? 0;

  const handleExport = () => {
    void exportMeasurementsToFile().catch(() => {
      toast.error("Export failed. Please try again.");
    });
  };

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="flex-row items-center justify-between p-4">
        <TabBar tabs={TABS} activeTab={filter} onTabChange={setFilter} />

        <View className="flex-row gap-3">
          <Button
            variant="tertiary"
            onPress={handleDeleteAllSynced}
            isDisabled={syncedCount === 0}
            icon={<Trash2 size={24} color={colors.primary.dark} strokeWidth={1.4} />}
            style={{ borderColor: "transparent", padding: 9 }}
          />
          <View>
            <Button
              variant="tertiary"
              onPress={handleSyncAll}
              isLoading={isUploading}
              isDisabled={unsyncedCount === 0}
              icon={<UploadCloud size={24} color={colors.primary.dark} strokeWidth={1.4} />}
              style={{ borderColor: "transparent", padding: 9 }}
            />
            {uploadingCount > 0 && (
              <View
                className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full px-1"
                style={{ backgroundColor: colors.semantic.info, height: 18 }}
              >
                <Text className="text-center text-[10px] font-bold text-white">
                  {uploadingCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      {measurements && measurements.length > 0 && (
        <View className="flex-row items-center justify-end gap-1 px-4 pb-2">
          <ChevronsLeft size={13} color={colors.neutral.gray500} />
          <Text className={clsx("text-sm font-normal", classes.textMuted)}>Swipe</Text>
        </View>
      )}
      {!measurements || measurements.length === 0 ? (
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
      ) : (
        <FlatList
          data={measurements}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 16 }}
          windowSize={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          ListFooterComponent={
            <View className="px-4 pt-4">
              <Button
                title="Export measurements"
                variant="tertiary"
                onPress={handleExport}
                icon={<Download size={16} color={colors.primary.dark} strokeWidth={1.4} />}
              />
            </View>
          }
        />
      )}

      {selectedMeasurement && (
        <MeasurementQuestionsModal
          visible={!!selectedMeasurement}
          measurement={selectedMeasurement}
          onClose={() => setSelectedMeasurement(null)}
        />
      )}

      {selectedForComment && (
        <CommentModal
          visible={!!selectedForComment}
          initialText={getCommentFromMeasurementResult(
            selectedForComment.data.measurementResult as Record<string, unknown>,
          )}
          experimentName={selectedForComment.experimentName}
          questions={selectedForComment.questions}
          timestamp={selectedForComment.timestamp}
          onSave={async (text) => {
            await updateMeasurementComment(selectedForComment.key, selectedForComment.data, text);
            invalidate();
            setSelectedForComment(null);
          }}
          onCancel={() => setSelectedForComment(null)}
        />
      )}
    </View>
  );
}
