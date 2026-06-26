import { Search, X } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { usePrecachedExperimentData } from "~/features/experiments/hooks/use-precached-experiment-data";
import { useRecentExperimentActivity } from "~/features/experiments/hooks/use-recent-experiment-activity";
import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useExperimentsFlowMeta } from "~/features/measurement-flow/hooks/use-experiments-flow-meta";
import { useLoadExperimentFlow } from "~/features/measurement-flow/hooks/use-load-experiment-flow";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import { Banner } from "~/shared/ui/Banner";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";
import { Tag } from "~/shared/ui/Tag";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { ellipsize } from "~/shared/utils/ellipsize";

import { ExperimentCard } from "./experiment-card";
import { OfflineModeIndicator } from "./offline-mode-indicator";

export function ExperimentSelectionStep() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("measurementFlow");
  const { experiments, isLoading, error, refetch, isRefetching } = useExperiments();
  const { selectedExperimentId, setSelectedExperimentId } = useExperimentSelectionStore();
  const setExperimentId = useMeasurementFlowStore((s) => s.setExperimentId);
  const { isReady: experimentFlowReady } = useLoadExperimentFlow(selectedExperimentId);
  const { clearHistory } = useFlowAnswersStore();
  const { data: precachedData } = usePrecachedExperimentData(selectedExperimentId);
  const { data: connectedDevice } = useConnectedDevice();
  const recentActivity = useRecentExperimentActivity();

  const [search, setSearch] = React.useState("");
  const ids = useMemo(() => experiments.map((e) => e.value), [experiments]);
  const flowMeta = useExperimentsFlowMeta(ids);

  // Surface experiments with measurements in the last 7 days first. Array sort
  // is stable, so experiments with no recent activity keep their original order
  // beneath the active ones.
  const sorted = useMemo(
    () =>
      [...experiments].sort(
        (a, b) => (recentActivity[b.label] ?? 0) - (recentActivity[a.label] ?? 0),
      ),
    [experiments, recentActivity],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (e) => e.label.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const selectedExperiment = experiments.find((e) => e.value === selectedExperimentId);
  const selectedMeta = selectedExperimentId ? flowMeta[selectedExperimentId] : undefined;
  const requiresSensor = !!selectedMeta?.requiresSensor;
  const isConnected = !!connectedDevice;
  const showSensorBanner = !!selectedExperimentId && requiresSensor && !isConnected;

  const handleStart = () => {
    if (!selectedExperimentId || !experimentFlowReady) return;
    clearHistory();
    setExperimentId(selectedExperimentId, selectedExperiment?.label);
  };

  return (
    <View className="flex-1">
      <View className="flex-1">
        <View className="px-4 pb-2 pt-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text
                className="text-on-surface"
                style={{ fontFamily: "Poppins-Bold", fontSize: 22, lineHeight: 26 }}
              >
                {t("experimentSelection.heroTitle")}
              </Text>
            </View>
            <OfflineModeIndicator isVisible={!!precachedData} />
          </View>

          <View className="mt-3">
            <Input
              value={search}
              onChangeText={setSearch}
              transparent
              placeholder={t("experimentSelection.searchPlaceholder")}
              leftIcon={<Search size={18} color={colors.inactive} />}
              rightElement={
                <View className="mr-2 flex-row items-center gap-1.5">
                  {search.length > 0 ? (
                    <TouchableOpacity
                      className="bg-gray-background rounded-md p-1"
                      onPress={() => setSearch("")}
                    >
                      <X size={18} color={colors.onSurface} />
                    </TouchableOpacity>
                  ) : null}
                  <Tag>{`${filtered.length}`}</Tag>
                </View>
              }
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color={colors.brand} />
            <Text className="text-muted-body mt-3 text-center">
              {t("experimentSelection.loadingExperiments")}
            </Text>
          </View>
        ) : error && experiments.length === 0 ? (
          // Only a hard failure with nothing cached shows the error; offline we
          // keep rendering the persisted list even though the refetch errored.
          <View className="items-center py-10">
            <Text className="text-error text-center">{t("experimentSelection.loadFailed")}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 0 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
                tintColor={colors.brand}
                colors={[colors.brand]}
              />
            }
            renderItem={({ item }) => {
              const meta = flowMeta[item.value];
              return (
                <ExperimentCard
                  id={item.value}
                  title={item.label}
                  description={item.description}
                  selected={selectedExperimentId === item.value}
                  onPress={setSelectedExperimentId}
                  requiresSensor={!!meta?.requiresSensor}
                  questionsOnly={!!meta?.questionsOnly}
                  nodeCount={meta?.nodeCount ?? 0}
                  durationMin={meta?.durationMin ?? 0}
                  recentCount={recentActivity[item.label] ?? 0}
                />
              );
            }}
          />
        )}
      </View>

      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 16,
          paddingTop: 8,
          gap: 10,
          backgroundColor: colors.background,
        }}
      >
        {showSensorBanner ? (
          <Banner
            title={t("experimentSelection.sensorBannerTitle")}
            body={t("experimentSelection.sensorBannerBody")}
            actionLabel={t("experimentSelection.sensorBannerAction")}
            onAction={() => useDeviceSheetStore.getState().open()}
          />
        ) : null}
        <Button
          title={
            selectedExperiment
              ? t("experimentSelection.startNamedFlow", {
                  label: ellipsize(selectedExperiment.label.trim(), 21),
                })
              : t("experimentSelection.startFlow")
          }
          onPress={handleStart}
          isDisabled={!selectedExperimentId || !experimentFlowReady}
          size="lg"
        />
      </View>
    </View>
  );
}
