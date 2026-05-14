import { RefreshCw } from "lucide-react-native";
import React from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Dropdown } from "~/components/Dropdown";
import { useExperimentMeasurements } from "~/hooks/use-experiment-measurements";
import { useExperiments } from "~/hooks/use-experiments";
import { useThemeColors } from "~/hooks/use-theme-colors";
import { useExperimentSelectionStore } from "~/stores/use-experiment-selection-store";
import { parseExperimentData } from "~/utils/parse-experiment-data";

import { ExperimentTables } from "./components";

export function ExperimentsScreen() {
  const themeColors = useThemeColors();
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
    <View className="bg-background flex-1 p-4">
      <View className="mb-6 flex-row items-center gap-3">
        <View className="flex-1">
          <Dropdown
            options={experiments}
            selectedValue={selectedExperimentId ?? undefined}
            onSelect={(experimentId) => setSelectedExperimentId(experimentId)}
            placeholder="Choose an experiment"
          />
        </View>

        {selectedExperimentId && (
          <TouchableOpacity
            className="border-border bg-surface h-11 w-11 items-center justify-center rounded-lg border shadow-sm shadow-black/10"
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
              <RefreshCw size={20} color={themeColors.onSurface} />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {selectedExperimentId ? (
        <View className="flex-1">
          <ExperimentTables tables={parsedTables} isLoading={isFetching} />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-inactive text-center text-base">
            Select an experiment to view data
          </Text>
        </View>
      )}
    </View>
  );
}
