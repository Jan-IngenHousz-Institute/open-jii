import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "expo-router";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { DevSeedMeasurementsDialog } from "~/features/recent-measurements/components/dev-seed-measurements-dialog";
import { MeasurementsDayHeader } from "~/features/recent-measurements/components/measurements-day-header";
import { MeasurementsHeaderActions } from "~/features/recent-measurements/components/measurements-header-actions";
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

const FLASHLIST_CONTENT_STYLE = { paddingTop: 12, paddingBottom: 16 };

export function RecentMeasurementsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { i18n } = useTranslation(["common", "recentMeasurements"]);
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

  // [perf] Defer the first heavy list commit (50 rows × a gesture-handler +
  // reanimated swipeable each ≈ 200 ms on the shared JS thread) until the
  // tab-transition interaction settles. paho parses PUBACKs on that same JS
  // thread, so committing the list synchronously on focus stalls the in-flight
  // acks ~1 s and inflates upload times. Yielding first lets paho drain the
  // queued acks, then the list mounts. Stays true after the first paint so
  // returning to the tab is instant. See OJD-1470.
  const [listReady, setListReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setListReady(true));
    // Fallback so a never-cleared interaction handle can't strand the list
    // behind the spinner; 500 ms still clears most tab transitions first.
    const fallback = setTimeout(() => setListReady(true), 500);
    return () => {
      task.cancel();
      clearTimeout(fallback);
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <MeasurementsHeaderActions
          onSyncAll={confirmSyncAll}
          onDeleteAllSynced={confirmDeleteAllSynced}
          onDevSeed={__DEV__ ? () => setDevSeedVisible(true) : undefined}
        />
      ),
    });
  }, [navigation, confirmSyncAll, confirmDeleteAllSynced, setDevSeedVisible]);

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
    if (build_ms > 12) {
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
      <MeasurementsToolbar filter={filter} onFilterChange={setFilter} showSwipeHint={hasItems} />

      {listReady ? (
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
          drawDistance={150}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.inactive} />
        </View>
      )}

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
