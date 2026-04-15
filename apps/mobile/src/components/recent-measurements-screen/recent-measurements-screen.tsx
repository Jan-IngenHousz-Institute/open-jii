import { clsx } from "clsx";
import { Download, ChevronsLeft, UploadCloud } from "lucide-react-native";
import React, { useState } from "react";
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
import { parseQuestions } from "~/utils/convert-cycle-answers-to-array";
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
  const [isExporting, setIsExporting] = useState(false);
  const { measurements, invalidate } = useAllMeasurements(filter as MeasurementFilter);
  const { uploadAll, isUploading, uploadOne, removeMeasurement, updateMeasurementComment } =
    useMeasurements();

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
        {
          text: "Cancel",
          variant: "ghost",
        },
      ],
    );
  };

  const handleSync = (id: string, experimentName: string, closeRow?: () => void) => {
    showAlert("Upload Measurement", `Are you sure you want to upload "${experimentName}"?`, [
      {
        text: "Upload",
        variant: "primary",
        onPress: () => {
          closeRow?.();
          void (async () => {
            await uploadOne(id);
            invalidate();
          })();
        },
      },
      {
        text: "Cancel",
        variant: "ghost",
      },
    ]);
  };

  const handleDelete = (id: string, status: "synced" | "unsynced", experimentName: string) => {
    const message =
      status === "synced"
        ? `Are you sure you want to delete "${experimentName}" from local storage?`
        : `Are you sure you want to remove "${experimentName}"? This will delete it from local storage.`;

    showAlert(status === "synced" ? "Delete Measurement" : "Remove Measurement", message, [
      {
        text: status === "synced" ? "Delete" : "Remove",
        variant: "danger",
        onPress: () => {
          void (() => {
            removeMeasurement(id);
            invalidate();
          })();
        },
      },
      {
        text: "Cancel",
        variant: "ghost",
      },
    ]);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportMeasurementsToFile();
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const unsyncedCount = measurements?.filter((m) => m.status === "unsynced").length ?? 0;

  const handleItemPress = (measurement: NonNullable<typeof measurements>[number]) => {
    setSelectedMeasurement(measurement);
  };

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="flex-row items-center justify-between p-4">
        <TabBar tabs={TABS} activeTab={filter} onTabChange={setFilter} />

        <View className="flex-row gap-3">
          <Button
            variant="tertiary"
            onPress={handleExport}
            isLoading={isExporting}
            isDisabled={!measurements || measurements.length === 0}
            icon={<Download size={24} color={colors.primary.dark} strokeWidth={1.4} />}
            style={{ borderColor: "transparent", padding: 9 }}
          />
          <Button
            variant="tertiary"
            onPress={handleSyncAll}
            isLoading={isUploading}
            isDisabled={unsyncedCount === 0}
            icon={<UploadCloud size={24} color={colors.primary.dark} strokeWidth={1.4} />}
            style={{ borderColor: "transparent", padding: 9 }}
          />
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
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 16 }}
          renderItem={({ item: measurement }) => (
            <SwipeableMeasurementRow
              id={measurement.key}
              timestamp={measurement.timestamp}
              experimentName={measurement.experimentName}
              status={measurement.status}
              questions={parseQuestions(measurement.data.measurementResult)}
              onPress={() => handleItemPress(measurement)}
              onComment={
                measurement.status === "unsynced"
                  ? () => setSelectedForComment(measurement)
                  : undefined
              }
              onDelete={() =>
                handleDelete(measurement.key, measurement.status, measurement.experimentName)
              }
              onSync={
                measurement.status === "unsynced"
                  ? (_, close) => handleSync(measurement.key, measurement.experimentName, close)
                  : undefined
              }
              hasComment={
                !!getCommentFromMeasurementResult(
                  measurement.data.measurementResult as Record<string, unknown>,
                )
              }
            />
          )}
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
          questions={parseQuestions(selectedForComment.data.measurementResult)}
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
