import { UploadCloud } from "lucide-react-native";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Button } from "~/components/Button";
import { OfflineBanner } from "~/components/OfflineBanner";
import { Toast } from "~/components/Toast";
import { UnsyncedScanItem } from "~/components/UnsyncedScanItem";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";
import { useHomeScreenLogic } from "~/screens/home/useHomeScreenLogic";

export default function HomeTab() {
  const theme = useTheme();
  const logic = useHomeScreenLogic();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark
            ? colors.dark.background
            : colors.light.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={logic.refreshing}
            onRefresh={logic.onRefresh}
            tintColor={colors.primary.dark}
            colors={[colors.primary.dark]}
          />
        }
      >
        <Text
          style={[
            styles.welcomeText,
            {
              color: theme.isDark
                ? colors.dark.onSurface
                : colors.light.onSurface,
            },
          ]}
        >
          Welcome to MultiSpeq
        </Text>
        <Text
          style={[
            styles.subtitleText,
            {
              color: theme.isDark
                ? colors.dark.inactive
                : colors.light.inactive,
            },
          ]}
        >
          Collect and analyze sensor data with ease
        </Text>

        <OfflineBanner visible={logic.isOffline} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.isDark
                    ? colors.dark.onSurface
                    : colors.light.onSurface,
                },
              ]}
            >
              Unsynced Measurements
            </Text>
            {logic.mockUnsyncedScans.length > 0 && (
              <Button
                title="Sync All"
                variant="outline"
                size="sm"
                onPress={logic.handleSyncAll}
                isLoading={logic.isSyncingAll}
                icon={<UploadCloud size={16} color={colors.primary.dark} />}
              />
            )}
          </View>

          {logic.mockUnsyncedScans.length > 0 ? (
            logic.mockUnsyncedScans.map((scan) => (
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
                  color: theme.isDark
                    ? colors.dark.inactive
                    : colors.light.inactive,
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
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
            ]}
          >
            Recent Activity
          </Text>
          <Text
            style={[
              styles.emptyText,
              {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            No recent activity
          </Text>
        </View>
      </ScrollView>

      <Toast
        visible={logic.toast.visible}
        message={logic.toast.message}
        type={logic.toast.type}
        onDismiss={() => logic.setToast({ ...logic.toast, visible: false })}
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
