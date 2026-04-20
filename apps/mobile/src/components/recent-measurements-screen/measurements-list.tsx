import { clsx } from "clsx";
import { ChevronsLeft } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, FlatList } from "react-native";
import { showAlert } from "~/components/AlertDialog";
import { CommentModal } from "~/components/recent-measurements-screen/comment-modal";
import { MeasurementQuestionsModal } from "~/components/recent-measurements-screen/measurement-questions-modal";
import { SwipeableMeasurementRow } from "~/components/recent-measurements-screen/swipeable-measurement-row";
import type { MeasurementItem as MeasurementItemType } from "~/hooks/use-all-measurements";
import { useMeasurements } from "~/hooks/use-measurements";
import { useTheme } from "~/hooks/use-theme";
import { parseQuestions } from "~/utils/convert-cycle-answers-to-array";
import { getCommentFromMeasurementResult } from "~/utils/measurement-annotations";

interface MeasurementListProps {
  measurements: MeasurementItemType[] | undefined;
  filter: string;
  invalidate: () => void;
  listFooter?: React.ReactElement | null;
}

export function MeasurementList({
  measurements,
  filter,
  invalidate,
  listFooter,
}: MeasurementListProps) {
  const { classes, colors } = useTheme();
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementItemType | null>(null);
  const [selectedForComment, setSelectedForComment] = useState<MeasurementItemType | null>(null);
  const { uploadOne, removeMeasurement, updateMeasurementComment } = useMeasurements();

  const handleSync = (id: string, experimentName: string) => {
    showAlert("Upload Measurement", `Are you sure you want to upload "${experimentName}"?`, [
      {
        text: "Upload",
        variant: "primary",
        onPress: () => {
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

  return (
    <>
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
              ? "Your measurements will appear here"
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
          ListFooterComponent={listFooter}
          renderItem={({ item: measurement }) => (
            <SwipeableMeasurementRow
              id={measurement.key}
              timestamp={measurement.timestamp}
              experimentName={measurement.experimentName}
              status={measurement.status}
              questions={parseQuestions(measurement.data.measurementResult)}
              onPress={() => setSelectedMeasurement(measurement)}
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
                  ? () => handleSync(measurement.key, measurement.experimentName)
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

      <CommentModal
        visible={!!selectedForComment}
        initialText={getCommentFromMeasurementResult(
          selectedForComment?.data.measurementResult as Record<string, unknown>,
        )}
        experimentName={selectedForComment?.experimentName ?? ""}
        questions={parseQuestions(selectedForComment?.data.measurementResult)}
        timestamp={selectedForComment?.timestamp ?? ""}
        onSave={async (text) => {
          if (!selectedForComment) return;
          await updateMeasurementComment(selectedForComment.key, selectedForComment.data, text);
          invalidate();
          setSelectedForComment(null);
        }}
        onCancel={() => setSelectedForComment(null)}
      />
    </>
  );
}
