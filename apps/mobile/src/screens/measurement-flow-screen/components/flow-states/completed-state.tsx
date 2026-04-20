import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/Button";
import { TabBar } from "~/components/TabBar";
import { MeasurementsList } from "~/components/recent-measurements-screen/measurements-list";
import { useAllMeasurements } from "~/hooks/use-all-measurements";
import type { MeasurementFilter } from "~/hooks/use-all-measurements";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

const TABS = [
  { key: "all", label: "All" },
  { key: "synced", label: "Synced" },
  { key: "unsynced", label: "Unsynced" },
];

type TabKey = (typeof TABS)[number]["key"];

export function CompletedState() {
  const [filter, setFilter] = useState<TabKey>("all");
  const { startNewIteration } = useMeasurementFlowStore();
  const { measurements, invalidate } = useAllMeasurements(filter as MeasurementFilter);

  return (
    <View className="flex-1">
      <View className="py-4">
        <TabBar tabs={TABS} activeTab={filter} onTabChange={setFilter} />
      </View>

      <MeasurementsList measurements={measurements} filter={filter} invalidate={invalidate} />

      <View className="px-4 py-3">
        <Button title="Start next measurement" onPress={startNewIteration} style={{ height: 44 }} />
      </View>
    </View>
  );
}
