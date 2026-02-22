import { clsx } from "clsx";
import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Button } from "~/components/Button";
import { MeasurementQuestionsModal } from "~/components/recent-measurements-screen/measurement-questions-modal";
import { SwipeableMeasurementRow } from "~/components/recent-measurements-screen/swipeable-measurement-row";
import { useAllMeasurements } from "~/hooks/use-all-measurements";
import type {
  MeasurementFilter,
  MeasurementItem as MeasurementItemType,
} from "~/hooks/use-all-measurements";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { useTheme } from "~/hooks/use-theme";
import { removeFailedUpload as removeFailedUploadFromStorage } from "~/services/failed-uploads-storage";
import { removeSuccessfulUpload } from "~/services/successful-uploads-storage";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

export function CompletedState() {
  const { colors, classes } = useTheme();
  const [filter, setFilter] = useState<MeasurementFilter>("all");
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementItemType | null>(null);
  const { startNewIteration, resetFlow } = useMeasurementFlowStore();
  const { clearHistory } = useFlowAnswersStore();
  const { measurements, invalidate } = useAllMeasurements(filter);
  const { uploadOne } = useFailedUploads();

  const handleFinishFlow = () => {
    resetFlow();
    clearHistory();
  };

  const handleSync = (id: string, experimentName: string) => {
    Alert.alert("Upload Measurement", `Are you sure you want to upload "${experimentName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Upload",
        onPress: (async () => {
          await uploadOne(id);
          invalidate();
        }) as any,
      },
    ]);
  };

  const handleDelete = (id: string, status: "synced" | "unsynced", experimentName: string) => {
    const message =
      status === "synced"
        ? `Are you sure you want to delete "${experimentName}" from local storage?`
        : `Are you sure you want to remove "${experimentName}"? This will delete it from local storage.`;

    Alert.alert(status === "synced" ? "Delete Measurement" : "Remove Measurement", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: status === "synced" ? "Delete" : "Remove",
        style: "destructive",
        onPress: (async () => {
          if (status === "synced") {
            await removeSuccessfulUpload(id);
          } else {
            await removeFailedUploadFromStorage(id);
          }
          invalidate();
        }) as any,
      },
    ]);
  };

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="p-4 pb-0">
        <Text className="mb-1 text-base font-semibold" style={{ color: colors.semantic.success }}>
          You just finished a measurement
        </Text>
        <Text className={clsx("mb-2 text-lg font-semibold", classes.text)}>
          Your recent measurements
        </Text>
        <Text className={clsx("mb-3 text-sm", classes.textSecondary)}>
          Check your answers or delete unsynced items.
        </Text>

        <View
          className={clsx("mb-3 flex-row rounded-lg border p-1", classes.border)}
          style={{ backgroundColor: colors.surface }}
        >
          <TouchableOpacity
            onPress={() => setFilter("all")}
            className="flex-1 rounded-md py-2"
            style={{
              backgroundColor: filter === "all" ? colors.primary.dark : "transparent",
            }}
            activeOpacity={0.7}
          >
            <Text
              className="text-center text-sm font-medium"
              style={{
                color: filter === "all" ? colors.onPrimary : colors.onSurface,
              }}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("synced")}
            className="flex-1 rounded-md py-2"
            style={{
              backgroundColor: filter === "synced" ? colors.primary.dark : "transparent",
            }}
            activeOpacity={0.7}
          >
            <Text
              className="text-center text-sm font-medium"
              style={{
                color: filter === "synced" ? colors.onPrimary : colors.onSurface,
              }}
            >
              Synced
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("unsynced")}
            className="flex-1 rounded-md py-2"
            style={{
              backgroundColor: filter === "unsynced" ? colors.primary.dark : "transparent",
            }}
            activeOpacity={0.7}
          >
            <Text
              className="text-center text-sm font-medium"
              style={{
                color: filter === "unsynced" ? colors.onPrimary : colors.onSurface,
              }}
            >
              Unsynced
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!measurements || measurements.length === 0 ? (
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
      ) : (
        <FlatList
          data={measurements}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item: measurement }) => (
            <SwipeableMeasurementRow
              id={measurement.key}
              timestamp={measurement.timestamp}
              experimentName={measurement.experimentName}
              status={measurement.status}
              onPress={() => setSelectedMeasurement(measurement)}
              onDelete={() =>
                handleDelete(measurement.key, measurement.status, measurement.experimentName)
              }
              onSync={
                measurement.status === "unsynced"
                  ? () => handleSync(measurement.key, measurement.experimentName)
                  : undefined
              }
            />
          )}
        />
      )}

      <View className={clsx("border-t p-4", classes.border)}>
        <View className="flex-row gap-3">
          <Button
            title="Finish Data Collection"
            onPress={handleFinishFlow}
            variant="outline"
            style={{ flex: 1 }}
            textStyle={{ color: "#ef4444" }}
          />
          <Button title="Start next measurement" onPress={startNewIteration} style={{ flex: 1 }} />
        </View>
      </View>

      {selectedMeasurement && (
        <MeasurementQuestionsModal
          visible={!!selectedMeasurement}
          measurement={selectedMeasurement}
          onClose={() => setSelectedMeasurement(null)}
        />
      )}
    </View>
  );
}
