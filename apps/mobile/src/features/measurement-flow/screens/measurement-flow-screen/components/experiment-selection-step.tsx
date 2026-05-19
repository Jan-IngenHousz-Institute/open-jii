import { Search } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { usePrecachedExperimentData } from "~/features/experiments/hooks/use-precached-experiment-data";
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
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { ExperimentCard } from "./experiment-card";
import { OfflineModeIndicator } from "./offline-mode-indicator";

export function ExperimentSelectionStep() {
  const { colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const insets = useSafeAreaInsets();
  const { experiments, isLoading, error } = useExperiments();
  const { selectedExperimentId, setSelectedExperimentId } = useExperimentSelectionStore();
  const setExperimentId = useMeasurementFlowStore((s) => s.setExperimentId);
  const { isReady: experimentFlowReady } = useLoadExperimentFlow(selectedExperimentId);
  const { clearHistory } = useFlowAnswersStore();
  const { data: precachedData } = usePrecachedExperimentData(selectedExperimentId);
  const { data: connectedDevice } = useConnectedDevice();

  const [search, setSearch] = React.useState("");
  const ids = useMemo(() => experiments.map((e) => e.value), [experiments]);
  const flowMeta = useExperimentsFlowMeta(ids);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return experiments;
    return experiments.filter(
      (e) => e.label.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q),
    );
  }, [experiments, search]);

  const selectedExperiment = experiments.find((e) => e.value === selectedExperimentId);
  const selectedMeta = selectedExperimentId ? flowMeta[selectedExperimentId] : undefined;
  const requiresSensor = !!selectedMeta?.requiresSensor;
  const isConnected = !!connectedDevice;
  const showSensorBanner = !!selectedExperimentId && requiresSensor && !isConnected;

  const handleStart = () => {
    if (!selectedExperimentId || !experimentFlowReady) return;
    clearHistory();
    setExperimentId(selectedExperimentId);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
              <Text className="text-muted-body mt-1 text-[13px]">
                {t("experimentSelection.heroSubtitle")}
              </Text>
            </View>
            <OfflineModeIndicator isVisible={!!precachedData} />
          </View>

          <View className="mt-3">
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder={t("experimentSelection.searchPlaceholder")}
              leftIcon={<Search size={18} color={colors.inactive} />}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 14 }}>
              {t("experimentSelection.assignedToYou")}
            </Text>
            {experiments.length > 0 ? <Tag>{`${experiments.length}`}</Tag> : null}
          </View>
        </View>

        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color={colors.brand} />
            <Text className="text-muted-body mt-3 text-center">
              {t("experimentSelection.loadingExperiments")}
            </Text>
          </View>
        ) : error ? (
          <View className="items-center py-10">
            <Text className="text-error text-center">{t("experimentSelection.loadFailed")}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200, gap: 10 }}
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
                />
              );
            }}
          />
        )}
      </View>

      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 16 + insets.bottom + 60,
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
                  label: selectedExperiment.label.split(" ")[0].toLowerCase(),
                })
              : t("experimentSelection.startFlow")
          }
          onPress={handleStart}
          isDisabled={!selectedExperimentId || !experimentFlowReady}
          size="lg"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
