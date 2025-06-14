import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Dropdown } from "~/components/Dropdown";
import { Toast } from "~/components/Toast";
import { useTheme } from "~/hooks/useTheme";

// Updated mock data with protocol name
const mockExperiments = [
  {
    label: "Leaf Photosynthesis",
    value: "leaf_photosynthesis",
    description: "Measures photosynthetic activity in leaves",
  },
  {
    label: "Chlorophyll Fluorescence",
    value: "chlorophyll_fluorescence",
    description: "Analyzes chlorophyll fluorescence parameters",
  },
  {
    label: "Absorbance Spectrum",
    value: "absorbance_spectrum",
    description: "Measures light absorbance across wavelengths",
  },
  {
    label: "Leaf Photosynthesis2",
    value: "leaf_photosynthesis2",
    description: "Measures photosynthetic activity in leaves",
  },
  {
    label: "Chlorophyll Fluorescence2",
    value: "chlorophyll_fluorescence2",
    description: "Analyzes chlorophyll fluorescence parameters",
  },
  {
    label: "Absorbance Spectrum2",
    value: "absorbance_spectrum2",
    description: "Measures light absorbance across wavelengths",
  },
];

const mockMeasurements = {
  leaf_photosynthesis: [
    {
      id: "lp1",
      timestamp: "2025-06-06 14:30:22",
      protocol: "LPX-2025-A1",
    },
    {
      id: "lp2",
      timestamp: "2025-06-05 11:15:43",
      protocol: "LPX-2025-B7",
    },
  ],
  chlorophyll_fluorescence: [
    {
      id: "cf1",
      timestamp: "2025-06-06 09:45:11",
      protocol: "CF-PROT-77",
    },
  ],
  absorbance_spectrum: [
    {
      id: "as1",
      timestamp: "2025-06-04 16:20:10",
      protocol: "ABS-RANGE-14",
    },
    {
      id: "as2",
      timestamp: "2025-06-03 10:10:00",
      protocol: "ABS-RANGE-15",
    },
  ],
};

export default function ExperimentsScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const [selectedExperiment, setSelectedExperiment] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  const onRefresh = async () => {};

  const handleSelectExperiment = (value: string) => {
    setSelectedExperiment(value);
  };

  const getMeasurementsForSelectedExperiment = () => {
    if (!selectedExperiment) return [];
    return (
      mockMeasurements[selectedExperiment as keyof typeof mockMeasurements] ||
      []
    );
  };

  const renderTableHeader = () => (
    <View style={styles.tableRow}>
      <Text style={[styles.headerCell, styles.flex2]}>ID</Text>
      <Text style={[styles.headerCell, styles.flex3]}>Protocol</Text>
      <Text style={[styles.headerCell, styles.flex3]}>Timestamp</Text>
    </View>
  );

  const renderTableRow = ({ item }: { item: any }) => (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.flex2]}>{item.id}</Text>
      <Text style={[styles.cell, styles.flex3]}>{item.protocol}</Text>
      <Text style={[styles.cell, styles.flex3]}>{item.timestamp}</Text>
    </View>
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
      <View style={styles.dropdownContainer}>
        <Dropdown
          label="Select Experiment"
          options={mockExperiments}
          selectedValue={selectedExperiment ?? undefined}
          onSelect={handleSelectExperiment}
          placeholder="Choose an experiment"
        />
      </View>

      {selectedExperiment ? (
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
            Measurements
          </Text>

          <FlatList
            data={getMeasurementsForSelectedExperiment()}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderTableHeader}
            renderItem={renderTableRow}
            contentContainerStyle={styles.measurementsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
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
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  headerCell: {
    fontWeight: "bold",
    fontSize: 14,
  },
  cell: {
    fontSize: 13,
  },
  flex2: {
    flex: 2,
  },
  flex3: {
    flex: 3,
  },
});
