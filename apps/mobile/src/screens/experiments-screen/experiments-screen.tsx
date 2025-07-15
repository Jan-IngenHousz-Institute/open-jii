import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Dropdown } from "~/components/Dropdown";
import { useExperimentsData } from "~/hooks/use-experiments-data";
import { useExperimentsDropdownOptions } from "~/hooks/use-experiments-dropdown-options";
import { useTheme } from "~/hooks/use-theme";
import { formatShortDate } from "~/utils/format-short-date";
import { MeasurementRecord } from "~/utils/map-rows-to-measurements";

export function ExperimentsScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const [selectedExperimentId, setSelectedExperimentId] = useState<string>();

  const { measurements, isFetching, refetch } = useExperimentsData(
    selectedExperimentId,
    "bronze_data_exp",
  );

  const { options } = useExperimentsDropdownOptions();

  const renderTableHeader = () => (
    <View style={styles.tableRow}>
      <Text style={[styles.headerCell, styles.flex2]}>Type</Text>
      <Text style={[styles.headerCell, styles.flex3]}>Protocol</Text>
      <Text style={[styles.headerCell, styles.flex3]}>Timestamp</Text>
    </View>
  );

  const renderTableRow = ({ item }: { item: MeasurementRecord }) => (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.flex2]} numberOfLines={1} ellipsizeMode="tail">
        {item.measurement_type}
      </Text>
      <Text style={[styles.cell, styles.flex3]} numberOfLines={1} ellipsizeMode="tail">
        {item.plant_name}
      </Text>
      <Text style={[styles.cell, styles.flex3]} numberOfLines={1} ellipsizeMode="tail">
        {formatShortDate(item.timestamp)}
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
      <View style={styles.dropdownContainer}>
        <Dropdown
          options={options}
          selectedValue={selectedExperimentId ?? undefined}
          onSelect={(experimentId) => setSelectedExperimentId(experimentId)}
          placeholder="Choose an experiment"
        />
      </View>

      {selectedExperimentId ? (
        <View style={styles.measurementsContainer}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            Measurements
          </Text>

          <FlatList
            data={measurements}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderTableHeader}
            renderItem={renderTableRow}
            contentContainerStyle={styles.measurementsList}
            refreshControl={
              <RefreshControl
                refreshing={isFetching}
                onRefresh={refetch}
                tintColor={colors.primary.dark}
                colors={[colors.primary.dark]}
              />
            }
            ListEmptyComponent={
              isFetching ? null : (
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                    },
                  ]}
                >
                  No measurements found for this experiment
                </Text>
              )
            }
          />
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <Text
            style={[
              styles.placeholderText,
              {
                color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
              },
            ]}
          >
            Select an experiment to view measurements
          </Text>
        </View>
      )}
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
    overflow: "hidden",
  },
  flex2: {
    flex: 2,
  },
  flex3: {
    flex: 3,
  },
});
