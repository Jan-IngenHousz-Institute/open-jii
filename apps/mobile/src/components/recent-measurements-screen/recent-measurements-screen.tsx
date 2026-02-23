import { clsx } from "clsx";
import { UploadCloud } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { toast } from "sonner-native";
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
import { removeSuccessfulUpload } from "~/services/successful-uploads-storage";

export function RecentMeasurementsScreen() {
  const { colors, classes } = useTheme();
  const [filter, setFilter] = useState<MeasurementFilter>("all");
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementItemType | null>(null);
  const { measurements, invalidate } = useAllMeasurements(filter);
  const { uploadAll, isUploading, uploadOne, removeFailedUpload } = useFailedUploads();

  const handleSyncAll = () => {
    Alert.alert(
      "Upload All Measurements",
      `Are you sure you want to sync ${unsyncedCount} unsynced measurement${unsyncedCount !== 1 ? "s" : ""}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Upload All",
          onPress: (async () => {
            try {
              await uploadAll();
              toast.success("All measurements synced successfully");
              invalidate();
            } catch {
              toast.error("Sync failed. Please try again.");
            }
          }) as any,
        },
      ],
    );
  };

  const handleSync = (id: string, experimentName: string) => {
    Alert.alert("Upload Measurement", `Are you sure you want to upload "${experimentName}"?`, [
      {
        text: "Cancel",
        style: "cancel",
      },
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
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: status === "synced" ? "Delete" : "Remove",
        style: "destructive",
        onPress: (async () => {
          if (status === "synced") {
            await removeSuccessfulUpload(id);
          } else {
            await removeFailedUpload(id);
          }
          invalidate();
        }) as any,
      },
    ]);
  };

  const unsyncedCount = measurements?.filter((m) => m.status === "unsynced").length ?? 0;

  const handleItemPress = (measurement: NonNullable<typeof measurements>[number]) => {
    setSelectedMeasurement(measurement);
  };

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="p-4 pb-0">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className={clsx("text-lg font-semibold", classes.text)}>Recent Measurements</Text>
          <Button
            title="Upload All"
            variant="outline"
            size="sm"
            onPress={handleSyncAll}
            isLoading={isUploading}
            isDisabled={unsyncedCount === 0}
            icon={<UploadCloud size={16} color={colors.primary.dark} />}
          />
        </View>

        <View
          className={clsx("mb-3 flex-row rounded-lg border p-1", classes.border)}
          style={{
            backgroundColor: colors.surface,
          }}
        >
          <TouchableOpacity
            onPress={() => setFilter("all")}
            className={clsx("flex-1 rounded-md py-2", filter === "all" ? "" : "")}
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
            className={clsx("flex-1 rounded-md py-2", filter === "synced" ? "" : "")}
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
            className={clsx("flex-1 rounded-md py-2", filter === "unsynced" ? "" : "")}
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item: measurement }) => (
            <SwipeableMeasurementRow
              id={measurement.key}
              timestamp={measurement.timestamp}
              experimentName={measurement.experimentName}
              status={measurement.status}
              onPress={() => handleItemPress(measurement)}
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
