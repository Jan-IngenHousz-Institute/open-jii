import { Trash2, UploadCloud } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { Button } from "~/components/Button";
import { TabBar } from "~/components/TabBar";
import type { MeasurementFilter } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";

const TABS: { key: MeasurementFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "synced", label: "Synced" },
  { key: "unsynced", label: "Unsynced" },
];

interface Props {
  filter: MeasurementFilter;
  onFilterChange: (filter: MeasurementFilter) => void;
  syncedCount: number;
  unsyncedCount: number;
  uploadingCount: number;
  isUploading: boolean;
  onSyncAll: () => void;
  onDeleteAllSynced: () => void;
}

export function MeasurementsToolbar({
  filter,
  onFilterChange,
  syncedCount,
  unsyncedCount,
  uploadingCount,
  isUploading,
  onSyncAll,
  onDeleteAllSynced,
}: Props) {
  const { colors } = useTheme();

  return (
    <View className="flex-row items-center justify-between p-4">
      <TabBar tabs={TABS} activeTab={filter} onTabChange={onFilterChange} />

      <View className="flex-row gap-3">
        <Button
          variant="tertiary"
          onPress={onDeleteAllSynced}
          isDisabled={syncedCount === 0}
          icon={<Trash2 size={24} color={colors.primary.dark} strokeWidth={1.4} />}
          style={{ borderColor: "transparent", padding: 9 }}
        />
        <View>
          <Button
            variant="tertiary"
            onPress={onSyncAll}
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
              <Text className="text-center text-[10px] font-bold text-white">{uploadingCount}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
