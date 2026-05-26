import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "expo-router";
import { ChevronsLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useHasAnyMeasurements } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useRecentMeasurementsActions } from "~/features/recent-measurements/hooks/use-recent-measurements-actions";
import { getMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import type { MeasurementDaySection } from "~/shared/utils/group-measurements-by-day";
import { groupMeasurementsByDay } from "~/shared/utils/group-measurements-by-day";
import { createLogger } from "~/shared/utils/logger";

const log = createLogger("recent-measurements");

type ListRow =
  | { kind: "header"; key: string; section: MeasurementDaySection }
  | { kind: "row"; key: string; item: MeasurementItem };

const FLASHLIST_CONTENT_STYLE = { paddingTop: 0, paddingBottom: 16 };

export function RecentMeasurementsScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation(["common", "recentMeasurements"]);
  const [filter, setFilter] = useState<MeasurementFilter>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [devSeedVisible, setDevSeedVisible] = useState(false);
  const closeModal = useCallback(() => setModal({ kind: "none" }), []);

  const {
    measurements,
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
  // Boolean-selected so the screen only re-renders when it flips 0↔n — not on
  // every settle tick (counts now live in the toolbar). See OJD-1470.
  const hasAnyMeasurements = useHasAnyMeasurements();

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

  // [perf] Mark every focus/blur of this tab so a JS-thread freeze in the
  // logs can be tied to the exact moment of the tab switch.
  useFocusEffect(
    useCallback(() => {
      log.info("focus");
      return () => log.info("blur");
    }, []),
  );

  // [perf] One line per data update that re-renders this screen — shows the
  // per-settle re-render cadence while the Outbox drains.
  useEffect(() => {
    log.info("data-changed", { measurements: measurements.length });
  }, [measurements]);

  const data = useMemo<ListRow[]>(() => {
    const t0 = Date.now();
    const sections = groupMeasurementsByDay(measurements, undefined, locale);
    const out: ListRow[] = [];
    for (const section of sections) {
      out.push({ kind: "header", key: `h:${section.key}`, section });
      for (const item of section.data) {
        out.push({ kind: "row", key: item.key, item });
      }
    }
    const build_ms = Date.now() - t0;
    if (build_ms > 8) {
      log.info("build-rows-slow", {
        build_ms,
        measurements: measurements.length,
        rows: out.length,
      });
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
      void openModal("questions", id);
    },
    [openModal],
  );
  const onRowComment = useCallback(
    (id: string) => {
      void openModal("comment", id);
    },
    [openModal],
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

  const listEmpty = useMemo(() => <MeasurementsListEmpty filter={filter} />, [filter]);
  const listFooter = useMemo(
    () => <MeasurementsListFooter onExport={handleExport} isDisabled={!hasAnyMeasurements} />,
    [handleExport, hasAnyMeasurements],
  );

  const hasItems = measurements.length > 0;

  return (
    <View className="bg-background flex-1">
      <MeasurementsToolbar
        filter={filter}
        onFilterChange={setFilter}
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
        contentContainerStyle={FLASHLIST_CONTENT_STYLE}
        ListEmptyComponent={listEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={listFooter}
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
