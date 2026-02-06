import { clsx } from "clsx";
import React, { useState } from "react";
import { View, Text, FlatList, ScrollView } from "react-native";
import { Button } from "~/components/Button";
import { MeasurementItem } from "~/components/measurement-item";
import { MeasurementQuestionsModal } from "~/components/recent-measurements-screen/measurement-questions-modal";
import { useAllMeasurements } from "~/hooks/use-all-measurements";
import type { MeasurementItem as MeasurementItemType } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

export function MeasurementHomeScreen() {
  const { classes } = useTheme();
  const { nextStep } = useMeasurementFlowStore();
  const { measurements } = useAllMeasurements("all");
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementItemType | null>(null);

  // Get recent measurements (limit to 10 most recent)
  const recentMeasurements = measurements?.slice(0, 10) ?? [];

  const handleStartMeasuring = () => {
    nextStep();
  };

  const handleItemPress = (measurement: MeasurementItemType) => {
    setSelectedMeasurement(measurement);
  };

  return (
    <ScrollView
      className={clsx("flex-1", classes.background)}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Header */}
      <View className="mb-6">
        <Text className={clsx("mb-2 text-3xl font-bold", classes.text)}>Measure</Text>
        <Text className={clsx("text-lg", classes.textSecondary)}>
          Start a new measurement or view your recent measurements
        </Text>
      </View>

      {/* Start Measuring Button */}
      <View className={clsx("mb-6 rounded-xl border p-6", classes.card, classes.border)}>
        <Button
          title="Start Measuring"
          onPress={handleStartMeasuring}
          size="lg"
          style={{ width: "100%" }}
        />
      </View>

      {/* Recent Measurements Section */}
      <View className="mb-4">
        <Text className={clsx("mb-3 text-xl font-semibold", classes.text)}>
          Recent Measurements
        </Text>
      </View>

      {recentMeasurements.length === 0 ? (
        <View className={clsx("rounded-xl border p-8", classes.card, classes.border)}>
          <Text className={clsx("text-center", classes.textSecondary)}>No recent measurements</Text>
          <Text className={clsx("mt-2 text-center text-sm", classes.textMuted)}>
            Start measuring to see your data here
          </Text>
        </View>
      ) : (
        <FlatList
          data={recentMeasurements}
          keyExtractor={(item) => item.key}
          scrollEnabled={false}
          renderItem={({ item: measurement }) => (
            <MeasurementItem
              id={measurement.key}
              timestamp={measurement.timestamp}
              experimentName={measurement.experimentName}
              status={measurement.status}
              onPress={() => handleItemPress(measurement)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-2" />}
        />
      )}

      {selectedMeasurement && (
        <MeasurementQuestionsModal
          visible={!!selectedMeasurement}
          measurement={selectedMeasurement}
          onClose={() => setSelectedMeasurement(null)}
        />
      )}
    </ScrollView>
  );
}
