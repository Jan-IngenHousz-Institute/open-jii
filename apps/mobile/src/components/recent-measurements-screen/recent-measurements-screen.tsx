import { clsx } from "clsx";
import { UploadCloud } from "lucide-react-native";
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { toast } from "sonner-native";
import { Button } from "~/components/Button";
import { UnsyncedScanItem } from "~/components/UnsyncedScanItem";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { useTheme } from "~/hooks/use-theme";

export function RecentMeasurementsScreen() {
  const { uploads, uploadAll, isUploading, removeFailedUpload, uploadOne } = useFailedUploads();
  const { colors, classes } = useTheme();

  const handleSyncAll = async () => {
    try {
      await uploadAll();
      toast.success("All measurements synced successfully");
    } catch {
      toast.error("Sync failed. Please try again.");
    }
  };

  return (
    <View className={clsx("flex-1", classes.background)}>
      <ScrollView className="flex-1 p-4">
        {uploads && uploads.length > 0 ? (
          <>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className={clsx("text-lg font-semibold", classes.text)}>
                Unsynced Measurements
              </Text>
              <Button
                title="Sync All"
                variant="outline"
                size="sm"
                onPress={handleSyncAll}
                isLoading={isUploading}
                icon={<UploadCloud size={16} color={colors.primary.dark} />}
              />
            </View>

            {uploads.map((measurement) => (
              <UnsyncedScanItem
                key={measurement.key}
                id={measurement.key}
                timestamp={measurement.data?.metadata?.timestamp ?? "N/A"}
                experimentName={measurement.data?.metadata?.experimentName ?? "N/A"}
                onDelete={() => removeFailedUpload(measurement.key)}
                onSync={() => uploadOne(measurement.key)}
              />
            ))}
          </>
        ) : (
          <View className="flex-1 items-center justify-center py-16">
            <Text className={clsx("text-center text-lg", classes.textSecondary)}>
              No unsynced measurements
            </Text>
            <Text className={clsx("mt-2 text-center", classes.textMuted)}>
              All measurements have been synced
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
