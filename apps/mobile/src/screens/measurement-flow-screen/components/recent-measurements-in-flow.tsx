import { clsx } from "clsx";
import { MessageSquare, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Button } from "~/components/Button";
import { CommentModal } from "~/components/comment-modal";
import { useAllMeasurements } from "~/hooks/use-all-measurements";
import type { MeasurementItem } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";
import { removeFailedUpload as removeFailedUploadFromStorage } from "~/services/failed-uploads-storage";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { formatTimeAgo } from "~/utils/format-time-ago";

interface RecentMeasurementsInFlowProps {
  onStartNextMeasurement: () => void;
}

export function RecentMeasurementsInFlow({
  onStartNextMeasurement,
}: RecentMeasurementsInFlowProps) {
  const { colors, classes } = useTheme();
  const { measurements, invalidate } = useAllMeasurements("all");
  const [selectedMeasurementForComment, setSelectedMeasurementForComment] =
    useState<MeasurementItem | null>(null);
  const { resetFlow } = useMeasurementFlowStore();

  // Get recent measurements (limit to 10 most recent)
  const recentMeasurements = measurements?.slice(0, 10) ?? [];

  const handleDelete = (measurement: MeasurementItem) => {
    if (measurement.status !== "unsynced") {
      return;
    }

    Alert.alert(
      "Delete Measurement",
      `Are you sure you want to delete "${measurement.experimentName}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeFailedUploadFromStorage(measurement.key);
            invalidate();
          },
        },
      ],
    );
  };

  const handleStartNext = () => {
    resetFlow();
    onStartNextMeasurement();
  };

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="p-4">
        <Text className={clsx("mb-4 text-2xl font-bold", classes.text)}>
          Your recent measurements
        </Text>

        {recentMeasurements.length === 0 ? (
          <View className={clsx("rounded-xl border p-8", classes.card, classes.border)}>
            <Text className={clsx("text-center", classes.textSecondary)}>
              No recent measurements
            </Text>
          </View>
        ) : (
          <FlatList
            data={recentMeasurements}
            keyExtractor={(item) => item.key}
            scrollEnabled={true}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item: measurement }) => (
              <View className={clsx("mb-3 rounded-lg border p-4", classes.card, classes.border)}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className={clsx("text-base font-bold", classes.text)}>
                      {measurement.experimentName}
                    </Text>
                    <Text className={clsx("mt-1 text-xs", classes.textMuted)}>
                      {formatTimeAgo(measurement.timestamp)}
                    </Text>
                    {measurement.comment && (
                      <View
                        className="mt-2 rounded-md px-3 py-2"
                        style={{ backgroundColor: colors.primary.dark + "15" }}
                      >
                        <Text className="text-sm" style={{ color: colors.primary.dark }}>
                          {measurement.comment}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="ml-2 flex-row gap-2">
                    {measurement.status === "unsynced" && (
                      <>
                        <TouchableOpacity
                          onPress={() => setSelectedMeasurementForComment(measurement)}
                          className="h-10 w-10 items-center justify-center rounded-lg"
                          style={{ backgroundColor: colors.primary.dark }}
                          activeOpacity={0.8}
                        >
                          <MessageSquare size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(measurement)}
                          className="h-10 w-10 items-center justify-center rounded-lg"
                          style={{ backgroundColor: colors.semantic.error }}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={20} color="#fff" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
        )}

        <View className="mt-4">
          <Button
            title="Start next measurement"
            onPress={handleStartNext}
            size="lg"
            style={{ width: "100%" }}
          />
        </View>
      </View>

      {selectedMeasurementForComment && (
        <CommentModal
          visible={!!selectedMeasurementForComment}
          measurementKey={selectedMeasurementForComment.key}
          onClose={() => setSelectedMeasurementForComment(null)}
          onSave={() => {
            invalidate();
          }}
        />
      )}
    </View>
  );
}
