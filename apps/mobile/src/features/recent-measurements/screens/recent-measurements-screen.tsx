import { FlashList } from "@shopify/flash-list";
import { useIsFocused } from "expo-router";
import { useNavigation } from "expo-router";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { MeasurementsDayHeader } from "~/features/recent-measurements/components/measurements-day-header";
import { MeasurementsHeaderActions } from "~/features/recent-measurements/components/measurements-header-actions";
import { MeasurementsListEmpty } from "~/features/recent-measurements/components/measurements-list-empty";
import { MeasurementsModals } from "~/features/recent-measurements/components/measurements-modals";
import type { ModalState } from "~/features/recent-measurements/components/measurements-modals";
import { MeasurementsRow } from "~/features/recent-measurements/components/measurements-row";
import { MeasurementsRunRow } from "~/features/recent-measurements/components/measurements-run-row";
import { MeasurementsToolbar } from "~/features/recent-measurements/components/measurements-toolbar";
import type {
  MeasurementFilter,
  MeasurementItem,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { useRecentMeasurementsActions } from "~/features/recent-measurements/hooks/use-recent-measurements-actions";
import type { MeasurementDaySection } from "~/features/recent-measurements/utils/group-measurements-by-day";
import { groupMeasurementsByDay } from "~/features/recent-measurements/utils/group-measurements-by-day";
import type { MeasurementRunEntry } from "~/features/recent-measurements/utils/group-measurements-by-run";
import { groupMeasurementsByRun } from "~/features/recent-measurements/utils/group-measurements-by-run";
import { getMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";
import { useTheme } from "~/shared/ui/hooks/use-theme";

const log = createLogger("recent-measurements");

type ListRow =
  | { kind: "header"; key: string; section: MeasurementDaySection }
  | { kind: "row"; key: string; item: MeasurementItem }
  | { kind: "run"; key: string; entry: MeasurementRunEntry; expanded: boolean }
  | { kind: "child"; key: string; item: MeasurementItem };

const FLASHLIST_CONTENT_STYLE = { paddingTop: 12, paddingBottom: 16 };

export function RecentMeasurementsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { i18n } = useTranslation(["common", "recentMeasurements"]);
  const [filter, setFilter] = useState<MeasurementFilter>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const closeModal = useCallback(() => setModal({ kind: "none" }), []);
  const isFocused = useIsFocused();
  const [peekToken, setPeekToken] = useState(0);

  const {
    measurements,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    confirmSync,
    confirmDelete,
    confirmSyncAll,
    confirmDeleteAllSynced,
    confirmSyncRun,
    confirmDeleteRun,
    saveComment,
  } = useRecentMeasurementsActions(filter);

  // Which workbook runs are open. Collapsed is the default: the point of the
  // run row is to keep one attempt to one list entry.
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});
  const toggleRun = useCallback((runKey: string) => {
    setExpandedRuns((prev) => ({ ...prev, [runKey]: !prev[runKey] }));
  }, []);

  // Expansion is per-filter-view: switching tabs resets it instead of letting
  // keys accumulate across deletes and day rollovers for the whole session.
  useEffect(() => setExpandedRuns({}), [filter]);

  // [perf] Defer the first heavy list commit (50 gesture-handler + reanimated
  // swipeables cost ~200 ms on the JS thread paho acks PUBACKs on) until the
  // tab transition settles, then stay mounted so return visits are instant.
  // See OJD-1470.
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
        />
      ),
    });
  }, [navigation, confirmSyncAll, confirmDeleteAllSynced]);

  // The list row is lean (no `measurement_result`). Loading the full payload
  // on tap is fast (~5-20 ms locally); see Scenario J in measurements-perf.
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

  // Day sections + run entries, keyed on the measurements alone: expanding a
  // run must not re-run the day bucketing (Luxon, per-item) that OJD-1470
  // keeps off the interaction path.
  const sectionEntries = useMemo(() => {
    // Runs collapse within a day, so a run that straddles midnight still
    // lands under both day headers rather than jumping out of one. The day
    // scopes the run key, keeping those two rows independent.
    return groupMeasurementsByDay(measurements, undefined, locale).map((section) => ({
      section,
      entries: groupMeasurementsByRun(section.data, section.key),
    }));
  }, [measurements, locale]);

  const data = useMemo<ListRow[]>(() => {
    const t0 = Date.now();
    const out: ListRow[] = [];
    for (const { section, entries } of sectionEntries) {
      out.push({ kind: "header", key: `h:${section.key}`, section });
      for (const entry of entries) {
        if (!entry.runId) {
          out.push({ kind: "row", key: entry.key, item: entry.items[0] });
          continue;
        }
        const expanded = !!expandedRuns[entry.key];
        out.push({ kind: "run", key: entry.key, entry, expanded });
        if (!expanded) continue;
        for (const item of entry.items) {
          out.push({ kind: "child", key: item.key, item });
        }
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
  }, [sectionEntries, expandedRuns, measurements.length]);

  const firstRowKey = useMemo(
    () => data.find((r) => r.kind === "row" || r.kind === "run")?.key,
    [data],
  );

  // Peek the most-recent row once per focus gain (when the deferred list is
  // ready) so the swipe action stays discoverable. Data churn while focused —
  // syncs settling, filter changes — must NOT re-fire the nudge.
  const wasFocused = useRef(false);
  const peekedThisFocus = useRef(false);
  useEffect(() => {
    if (isFocused && !wasFocused.current) peekedThisFocus.current = false;
    wasFocused.current = isFocused;
    if (isFocused && listReady && firstRowKey && !peekedThisFocus.current) {
      peekedThisFocus.current = true;
      setPeekToken((t) => t + 1);
    }
  }, [isFocused, listReady, firstRowKey]);

  const itemsById = useMemo(() => {
    const map = new Map<string, MeasurementItem>();
    for (const item of measurements) map.set(item.key, item);
    return map;
  }, [measurements]);

  // Run rows hand back their `run:<dayKey>:<id>` key; the actions take the
  // entry's run id (and experiment name for the confirmation copy) and resolve
  // the full membership from storage — the rendered slice is not authoritative.
  const runsByKey = useMemo(() => {
    const map = new Map<string, MeasurementRunEntry>();
    for (const row of data) {
      if (row.kind === "run") map.set(row.key, row.entry);
    }
    return map;
  }, [data]);

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
  const onRunDelete = useCallback(
    (runKey: string) => {
      const entry = runsByKey.get(runKey);
      // Run actions resolve membership from storage by run id; the entry only
      // supplies the id and the experiment name for the confirmation copy.
      if (entry?.runId) void confirmDeleteRun(entry.runId, entry.items[0].experimentName);
    },
    [runsByKey, confirmDeleteRun],
  );
  const onRunSync = useCallback(
    (runKey: string) => {
      const entry = runsByKey.get(runKey);
      if (entry?.runId) void confirmSyncRun(entry.runId, entry.items[0].experimentName);
    },
    [runsByKey, confirmSyncRun],
  );

  const renderItem = useCallback(
    ({ item: row }: { item: ListRow }) => {
      if (row.kind === "header") {
        return <MeasurementsDayHeader section={row.section} />;
      }
      if (row.kind === "run") {
        return (
          <MeasurementsRunRow
            entry={row.entry}
            expanded={row.expanded}
            onToggle={toggleRun}
            onSync={onRunSync}
            onDelete={onRunDelete}
            peekToken={row.key === firstRowKey ? peekToken : 0}
          />
        );
      }
      return (
        <MeasurementsRow
          item={row.item}
          onPress={onRowPress}
          onComment={onRowComment}
          onDelete={onRowDelete}
          onSync={onRowSync}
          peekToken={row.key === firstRowKey ? peekToken : 0}
          indented={row.kind === "child"}
        />
      );
    },
    [
      onRowPress,
      onRowComment,
      onRowDelete,
      onRowSync,
      onRunSync,
      onRunDelete,
      toggleRun,
      peekToken,
      firstRowKey,
    ],
  );

  const keyExtractor = useCallback((row: ListRow) => row.key, []);
  const getItemType = useCallback((row: ListRow) => row.kind, []);

  const listEmpty = useMemo(() => <MeasurementsListEmpty filter={filter} />, [filter]);

  return (
    <View className="bg-background flex-1">
      <MeasurementsToolbar filter={filter} onFilterChange={setFilter} />

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
          drawDistance={150}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.inactive} />
        </View>
      )}

      <MeasurementsModals state={modal} onClose={closeModal} onSaveComment={saveComment} />
    </View>
  );
}
