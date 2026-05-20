import { FlashList } from "@shopify/flash-list";
import { ChevronsLeft } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { DevSeedMeasurementsDialog } from "~/features/recent-measurements/components/dev-seed-measurements-dialog";
import { MeasurementsDayHeader } from "~/features/recent-measurements/components/measurements-day-header";
import { MeasurementsListEmpty } from "~/features/recent-measurements/components/measurements-list-empty";
import { MeasurementsListFooter } from "~/features/recent-measurements/components/measurements-list-footer";
import { MeasurementsModals } from "~/features/recent-measurements/components/measurements-modals";
import type { ModalState } from "~/features/recent-measurements/components/measurements-modals";
import { MeasurementsRow } from "~/features/recent-measurements/components/measurements-row";
import { MeasurementsToolbar } from "~/features/recent-measurements/components/measurements-toolbar";
import type {
  MeasurementFilter,
  MeasurementItem,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { useRecentMeasurementsActions } from "~/features/recent-measurements/hooks/use-recent-measurements-actions";
import { getMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import type { MeasurementDaySection } from "~/shared/utils/group-measurements-by-day";
import { groupMeasurementsByDay } from "~/shared/utils/group-measurements-by-day";

type ListRow =
  | { kind: "header"; key: string; section: MeasurementDaySection }
  | { kind: "row"; key: string; item: MeasurementItem };

export function RecentMeasurementsScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation(["common", "recentMeasurements"]);
  const [filter, setFilter] = useState<MeasurementFilter>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [devSeedVisible, setDevSeedVisible] = useState(false);
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

  const data = useMemo<ListRow[]>(() => {
    const sections = groupMeasurementsByDay(measurements, undefined, locale);
    const out: ListRow[] = [];
    for (const section of sections) {
      out.push({ kind: "header", key: `h:${section.key}`, section });
      for (const item of section.data) {
        out.push({ kind: "row", key: item.key, item });
      }
    }
    return out;
  }, [measurements, locale]);

  const itemsById = useMemo(() => {
    const map = new Map<string, MeasurementItem>();
    for (const item of measurements) map.set(item.key, item);
    return map;
  }, [measurements]);

  const onRowPress = useCallback(
    (id: string) => {
      const item = itemsById.get(id);
      if (item) setModal({ kind: "questions", measurement: item });
    },
    [itemsById],
  );
  const onRowComment = useCallback(
    (id: string) => {
      const item = itemsById.get(id);
      if (item) setModal({ kind: "comment", measurement: item });
    },
    [itemsById],
  );
  const onRowDelete = useCallback(
    (id: string) => {
      const item = itemsById.get(id);
      if (item) confirmDelete(item);
    },
    [itemsById, confirmDelete],
  );
  const onRowSync = useCallback(
    (id: string) => {
      const item = itemsById.get(id);
      if (item) confirmSync(item);
    },
    [itemsById, confirmSync],
  );

  const renderItem = useCallback(
    ({ item: row }: { item: ListRow }) => {
      if (row.kind === "header") {
        return <MeasurementsDayHeader section={row.section} />;
      }
      return (
        <MeasurementsRow
          item={row.item}
          onPress={onRowPress}
          onComment={onRowComment}
          onDelete={onRowDelete}
          onSync={onRowSync}
        />
      );
    },
    [onRowPress, onRowComment, onRowDelete, onRowSync],
  );

  const keyExtractor = useCallback((row: ListRow) => row.key, []);
  const getItemType = useCallback((row: ListRow) => row.kind, []);

  const hasItems = measurements.length > 0;

  return (
    <View className="bg-background flex-1">
      <MeasurementsToolbar
        filter={filter}
        onFilterChange={setFilter}
        syncedCount={syncedCount}
        unsyncedCount={unsyncedCount}
        uploadingCount={uploadingCount}
        isUploading={isUploading}
        onSyncAll={confirmSyncAll}
        onDeleteAllSynced={confirmDeleteAllSynced}
        onDevSeed={__DEV__ ? () => setDevSeedVisible(true) : undefined}
      />

      {hasItems && (
        <View className="flex-row items-center justify-end gap-1 px-4 pb-2">
          <ChevronsLeft size={13} color={colors.inactive} />
          <Text className="text-muted-body text-sm font-normal">
            {t("recentMeasurements:list.swipeHint")}
          </Text>
        </View>
      )}

      <FlashList
        data={data}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 16 }}
        ListEmptyComponent={<MeasurementsListEmpty filter={filter} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <MeasurementsListFooter onExport={handleExport} isDisabled={!hasAnyMeasurements} />
        }
      />

      <MeasurementsModals state={modal} onClose={closeModal} onSaveComment={saveComment} />
      {__DEV__ && (
        <DevSeedMeasurementsDialog
          visible={devSeedVisible}
          onClose={() => setDevSeedVisible(false)}
        />
      )}
    </View>
  );
}
