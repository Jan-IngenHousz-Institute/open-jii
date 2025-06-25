import { UploadCloud } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Button } from "~/components/Button";
import { OfflineBanner } from "~/components/OfflineBanner";
import { Toast } from "~/components/Toast";
import { UnsyncedScanItem } from "~/components/UnsyncedScanItem";
import { useTheme } from "~/hooks/use-theme";

// Mock data - replace with actual data from your state management
const mockUnsyncedScans = [
  {
    id: "1",
    timestamp: "2025-06-06 14:30:22",
    experimentName: "Leaf Photosynthesis",
  },
  {
    id: "2",
    timestamp: "2025-06-06 15:45:10",
    experimentName: "Chlorophyll Fluorescence",
  },
];

export default function HomeScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  // Simulate refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);

    // Simulate network check
    const randomOffline = Math.random() > 0.7;
    setIsOffline(randomOffline);

    if (!randomOffline) {
      setToast({
        visible: true,
        message: "Connected to network",
        type: "success",
      });
    }
  };

  // Simulate retry sync all
  const handleSyncAll = async () => {
    setIsSyncingAll(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check if we're "online"
      if (!isOffline) {
        setToast({
          visible: true,
          message: "All measurements synced successfully",
          type: "success",
        });

        // In a real app, you would remove these items from your store
      } else {
        setToast({
          visible: true,
          message: "Sync failed: You are offline",
          type: "error",
        });
      }
    } catch {
      setToast({
        visible: true,
        message: "Sync failed. Please try again.",
        type: "error",
      });
    } finally {
      setIsSyncingAll(false);
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
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.dark}
            colors={[colors.primary.dark]}
          />
        }
      >
        <Text
          style={[
            styles.welcomeText,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          Welcome to MultiSpeq
        </Text>
        <Text
          style={[
            styles.subtitleText,
            {
              color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
            },
          ]}
        >
          Collect and analyze sensor data with ease
        </Text>

        <OfflineBanner visible={isOffline} />

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
            {mockUnsyncedScans.length > 0 && (
              <Button
                title="Sync All"
                variant="outline"
                size="sm"
                onPress={handleSyncAll}
                isLoading={isSyncingAll}
                icon={<UploadCloud size={16} color={colors.primary.dark} />}
              />
            )}
          </View>

          {mockUnsyncedScans.length > 0 ? (
            mockUnsyncedScans.map((scan) => (
              <UnsyncedScanItem
                key={scan.id}
                id={scan.id}
                timestamp={scan.timestamp}
                experimentName={scan.experimentName}
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
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            Recent Activity
          </Text>
          <Text
            style={[
              styles.emptyText,
              {
                color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
              },
            ]}
          >
            No recent activity
          </Text>
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
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
  subtitleText: {
    fontSize: 16,
    marginBottom: 24,
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
