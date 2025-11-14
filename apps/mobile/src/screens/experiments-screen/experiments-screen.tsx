import { RefreshCw } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
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
  const rotateValue = React.useRef(new Animated.Value(0)).current;

  const { selectedExperimentId, setSelectedExperimentId } = useExperimentSelectionStore();

  const { data, isFetching, refetch } = useExperimentMeasurements(selectedExperimentId);
  const { experiments } = useExperiments();

  const parsedTables = data?.body ? parseExperimentData(data.body) : [];

  React.useEffect(() => {
    if (isFetching) {
      const rotation = Animated.loop(
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      );
      rotation.start();
      return () => rotation.stop();
    } else {
      rotateValue.setValue(0);
    }
  }, [isFetching, rotateValue]);

  const handleRefresh = () => {
    refetch();
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
      <View style={styles.headerContainer}>
        <View style={styles.dropdownContainer}>
          <Dropdown
            options={experiments}
            selectedValue={selectedExperimentId ?? undefined}
            onSelect={(experimentId) => setSelectedExperimentId(experimentId)}
            placeholder="Choose an experiment"
          />
        </View>

        {selectedExperimentId && (
          <TouchableOpacity
            style={[
              styles.refreshButton,
              {
                backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
                borderColor: theme.isDark ? colors.dark.border : colors.light.border,
              },
            ]}
            onPress={handleRefresh}
            disabled={isFetching}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: rotateValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
              }}
            >
              <RefreshCw
                size={20}
                color={theme.isDark ? colors.dark.onSurface : colors.light.onSurface}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
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
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  dropdownContainer: {
    flex: 1,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
