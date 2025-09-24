import { UploadCloud } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Button } from "~/components/Button";
import { UnsyncedScanItem } from "~/components/UnsyncedScanItem";
import { ConnectionSetup } from "~/components/connection-setup";
import { useToast } from "~/context/toast-context";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { useTheme } from "~/hooks/use-theme";

export default function HomeScreen() {
  const { uploads, uploadAll, isUploading, removeFailedUpload, uploadOne } = useFailedUploads();
  const theme = useTheme();
  const { colors } = theme;

  const { showToast } = useToast();

  const handleSyncAll = async () => {
    try {
      await uploadAll();
      showToast("All measurements synced successfully", "success");
    } catch {
      showToast("Sync failed. Please try again.", "error");
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isUploading}
            tintColor={colors.primary.dark}
            colors={[colors.primary.dark]}
          />
        }
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                },
              ]}
            >
              Unsynced Measurements
            </Text>
            {uploads.length > 0 && (
              <Button
                title="Sync All"
                variant="outline"
                size="sm"
                onPress={handleSyncAll}
                isLoading={isUploading}
                icon={<UploadCloud size={16} color={colors.primary.dark} />}
              />
            )}
          </View>

          {uploads.length > 0 ? (
            uploads.map((measurement) => (
              <UnsyncedScanItem
                key={measurement.key}
                id={measurement.key}
                timestamp={measurement.data.metadata.timestamp ?? "N/A"}
                experimentName={measurement.data.metadata.experimentName ?? "N/A"}
                onDelete={() => removeFailedUpload(measurement.key)}
                onSync={() => uploadOne(measurement.key)}
              />
            ))
          ) : (
            <Text
              style={[
                styles.emptyText,
                {
                  color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                },
              ]}
            >
              No unsynced measurements
            </Text>
          )}
        </View>
        <View style={styles.section}>
          <ConnectionSetup />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    padding: 24,
  },
});
