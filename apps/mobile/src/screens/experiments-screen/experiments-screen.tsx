import React from "react";
import { View, Text, StyleSheet, RefreshControl } from "react-native";
import { Dropdown } from "~/components/Dropdown";
import { useExperimentMeasurements } from "~/hooks/use-experiment-measurements";
import { useExperiments } from "~/hooks/use-experiments";
import { useTheme } from "~/hooks/use-theme";
import { useExperimentSelectionStore } from "~/stores/use-experiment-selection-store";
import { parseExperimentData } from "~/utils/parse-experiment-data";

import { ExperimentTables } from "./components";

export function ExperimentsScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const { selectedExperimentId, setSelectedExperimentId } = useExperimentSelectionStore();

  const { data, isFetching, refetch } = useExperimentMeasurements(selectedExperimentId);
  const { experiments } = useExperiments();

  const parsedTables = data?.body ? parseExperimentData(data.body) : [];

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
          options={experiments}
          selectedValue={selectedExperimentId ?? undefined}
          onSelect={(experimentId) => setSelectedExperimentId(experimentId)}
          placeholder="Choose an experiment"
        />
      </View>

      {selectedExperimentId ? (
        <View style={styles.measurementsContainer}>
          <ExperimentTables tables={parsedTables} isLoading={isFetching} />
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
            Select an experiment to view data
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
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    textAlign: "center",
  },
});
