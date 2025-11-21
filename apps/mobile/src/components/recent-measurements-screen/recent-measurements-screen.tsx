import { clsx } from "clsx";
import { UploadCloud } from "lucide-react-native";
import React from "react";
import { View, Text, FlatList } from "react-native";
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

  if (!uploads || uploads.length === 0) {
    return (
      <View className={clsx("flex-1 items-center justify-center p-4", classes.background)}>
        <Text className={clsx("text-center text-lg", classes.textSecondary)}>
          No unsynced measurements
        </Text>
        <Text className={clsx("mt-2 text-center", classes.textMuted)}>
          All measurements have been synced
        </Text>
      </View>
    );
  }

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="p-4 pb-2">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className={clsx("text-lg font-semibold", classes.text)}>Unsynced Measurements</Text>
          <Button
            title="Sync All"
            variant="outline"
            size="sm"
            onPress={handleSyncAll}
            isLoading={isUploading}
            icon={<UploadCloud size={16} color={colors.primary.dark} />}
          />
        </View>
      </View>

      <FlatList
        data={uploads}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        renderItem={({ item: measurement }) => (
          <UnsyncedScanItem
            id={measurement.key}
            timestamp={measurement.data?.metadata?.timestamp ?? "N/A"}
            experimentName={measurement.data?.metadata?.experimentName ?? "N/A"}
            onDelete={() => removeFailedUpload(measurement.key)}
            onSync={() => uploadOne(measurement.key)}
          />
        )}
      />
    </View>
  );
}
