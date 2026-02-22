import { clsx } from "clsx";
import { useRouter } from "expo-router";
import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/Button";
import { RecentMeasurementsScreen } from "~/components/recent-measurements-screen/recent-measurements-screen";
import { useTheme } from "~/hooks/use-theme";

export default function MeasureLandingScreen() {
  const { classes } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className={clsx("flex-1", classes.background)}>
      {/* Top section ~2/5: title, status, intro, card + Start measuring button */}
      <View
        style={{
          flex: 0.4,
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        <View className="mb-2 flex-row items-center justify-between">
          <Text className={clsx("text-2xl font-bold", classes.text)}>Measure</Text>
        </View>

        <Text className={clsx("mb-4 text-sm", classes.textSecondary)}>
          Start your measurement flow or go ahead and check out your most recent measurements.
        </Text>

        <View
          className={clsx("flex-1 rounded-xl border p-4", classes.card, classes.border)}
          style={{ justifyContent: "center", minHeight: 120 }}
        >
          <Text className={clsx("mb-4 text-sm", classes.textSecondary)}>
            Ready to measure? Let's collect your data and see the results in real time.
          </Text>
          <Button
            title="Start measuring"
            variant="primary"
            size="lg"
            onPress={() => router.push("/(tabs)/measurement-flow/flow")}
            style={{ alignSelf: "stretch" }}
          />
        </View>
      </View>

      {/* Bottom section ~3/5: recent measurements (same as Recents tab) */}
      <View style={{ flex: 0.6 }}>
        <RecentMeasurementsScreen />
      </View>
    </View>
  );
}
