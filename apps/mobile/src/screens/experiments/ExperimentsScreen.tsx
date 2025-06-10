import React from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Dropdown } from "~/components/Dropdown";
import { MeasurementItem } from "~/components/MeasurementItem";
import { OfflineBanner } from "~/components/OfflineBanner";
import { Toast } from "~/components/Toast";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

import { useExperimentsScreenLogic } from "./useExperimentsScreenLogic";

export function ExperimentsScreen() {
  const theme = useTheme();
  const logic = useExperimentsScreenLogic();

  const renderMeasurementItem = ({ item }: { item: any }) => (
    <MeasurementItem
      id={item.id}
      timestamp={item.timestamp}
      data={item.data}
      onPress={() => {
        logic.setToast({
          visible: true,
          message: `Viewing measurement ${item.id}`,
          type: "info",
        });
      }}
    />
  );

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
      <OfflineBanner visible={logic.isOffline} />

      <View style={styles.dropdownContainer}>
        <Dropdown
          label="Select Experiment"
          options={logic.mockExperiments}
          selectedValue={logic.selectedExperiment ?? undefined}
          onSelect={logic.handleSelectExperiment}
          placeholder="Choose an experiment"
        />
      </View>

      {logic.selectedExperiment ? (
        <View style={styles.measurementsContainer}>
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
            Previous Measurements
          </Text>

          <FlatList
            data={logic.getMeasurementsForSelectedExperiment()}
            keyExtractor={(item) => item.id}
            renderItem={renderMeasurementItem}
            contentContainerStyle={styles.measurementsList}
            refreshControl={
              <RefreshControl
                refreshing={logic.refreshing}
                onRefresh={logic.onRefresh}
                tintColor={colors.primary.dark}
                colors={[colors.primary.dark]}
              />
            }
            ListEmptyComponent={
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
                No measurements found for this experiment
              </Text>
            }
          />
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <Text
            style={[
              styles.placeholderText,
              {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            Select an experiment to view measurements
          </Text>
        </View>
      )}

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
    padding: 16,
  },
  dropdownContainer: {
    marginBottom: 24,
  },
  measurementsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  measurementsList: {
    flexGrow: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    padding: 24,
  },
});
