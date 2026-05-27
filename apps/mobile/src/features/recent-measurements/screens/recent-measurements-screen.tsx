import { useNavigation } from "expo-router";
import { Download } from "lucide-react-native";
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { SectionList, Text, View } from "react-native";
import { MeasurementsHeaderActions } from "~/features/recent-measurements/components/measurements-header-actions";
import { MeasurementsModals } from "~/features/recent-measurements/components/measurements-modals";
import type { ModalState } from "~/features/recent-measurements/components/measurements-modals";
import { MeasurementsToolbar } from "~/features/recent-measurements/components/measurements-toolbar";
import { SwipeableMeasurementRow } from "~/features/recent-measurements/components/swipeable-measurement-row";
import type {
  MeasurementFilter,
  MeasurementItem,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { useRecentMeasurementsActions } from "~/features/recent-measurements/hooks/use-recent-measurements-actions";
import { getMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { groupMeasurementsByDay } from "~/shared/utils/group-measurements-by-day";

export function RecentMeasurementsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation(["common", "recentMeasurements"]);
  const [filter, setFilter] = useState<MeasurementFilter>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const closeModal = useCallback(() => setModal({ kind: "none" }), []);

  const {
    measurements,
    hasAnyMeasurements,
    syncedCount,
    unsyncedCount,
    uploadingCount,
    isUploading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    confirmSync,
    confirmDelete,
    confirmSyncAll,
    confirmDeleteAllSynced,
    handleExport,
    saveComment,
  } = useRecentMeasurementsActions(filter);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <MeasurementsHeaderActions
          syncedCount={syncedCount}
          unsyncedCount={unsyncedCount}
          uploadingCount={uploadingCount}
          isUploading={isUploading}
          onSyncAll={confirmSyncAll}
          onDeleteAllSynced={confirmDeleteAllSynced}
        />
      ),
    });
  }, [
    navigation,
    syncedCount,
    unsyncedCount,
    uploadingCount,
    isUploading,
    confirmSyncAll,
    confirmDeleteAllSynced,
  ]);

  // The list row is lean (no `measurement_result`). Loading the full payload
  // on tap is fast (~5–20 ms locally) — see Scenario J in measurements-perf.
  const openModal = useCallback(async (kind: "questions" | "comment", id: string) => {
    const full = await getMeasurement(id);
    if (full) setModal({ kind, measurement: full });
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const locale = i18n.language === "nl-NL" ? "nl-NL" : "en-GB";
  const sections = useMemo(
    () => groupMeasurementsByDay(measurements, undefined, locale),
    [measurements, locale],
  );

  const renderItem = ({ item }: { item: MeasurementItem }) => (
    <SwipeableMeasurementRow
      id={item.key}
      timestamp={item.timestamp}
      experimentName={item.experimentName}
      status={item.status}
      questions={item.questions}
      onPress={() => void openModal("questions", item.key)}
      onComment={
        item.status === "pending" || item.status === "failed"
          ? () => void openModal("comment", item.key)
          : undefined
      }
      onDelete={() => confirmDelete(item)}
      onSync={
        item.status === "pending" || item.status === "failed" ? () => confirmSync(item) : undefined
      }
      hasComment={item.hasComment}
    />
  );

  const hasItems = measurements.length > 0;

  return (
    <View className="bg-background flex-1">
      <MeasurementsToolbar
        filter={filter}
        onFilterChange={setFilter}
        syncedCount={syncedCount}
        unsyncedCount={unsyncedCount}
        showSwipeHint={hasItems}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => {
          const i18nKey =
            section.kind === "today"
              ? "recentMeasurements:sectionHeader.today"
              : section.kind === "yesterday"
                ? "recentMeasurements:sectionHeader.yesterday"
                : "recentMeasurements:sectionHeader.other";
          return (
            <View className="bg-background px-4 pb-2 pt-6">
              <Text
                className="text-muted-body text-[12px] font-bold uppercase"
                style={{ letterSpacing: 0.6 }}
              >
                {t(i18nKey, { date: section.dateLabel })}
              </Text>
            </View>
          );
        }}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 16, flexGrow: 1 }}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-on-surface text-center text-lg">
              {t("recentMeasurements:list.emptyTitle")}
            </Text>
            <Text className="text-muted-body mt-2 text-center">
              {filter === "all"
                ? t("recentMeasurements:list.emptyHintAll")
                : filter === "synced"
                  ? t("recentMeasurements:list.emptyHintSynced")
                  : t("recentMeasurements:list.emptyHintUnsynced")}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="px-4 pt-4">
            <Button
              title={t("recentMeasurements:list.exportButton")}
              variant="tertiary"
              onPress={handleExport}
              isDisabled={!hasAnyMeasurements}
              icon={<Download size={16} color={colors.brand} strokeWidth={1.4} />}
            />
          </View>
        }
      />

      <MeasurementsModals state={modal} onClose={closeModal} onSaveComment={saveComment} />
    </View>
  );
}
