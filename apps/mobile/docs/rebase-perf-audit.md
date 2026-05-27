# Post-rebase perf audit — OJD-1470 vs OJD-1537 base

> **Historical — snapshot at audit time.** Some sections below reference the
> 4×8 = 32 parallel-socket MQTT pool that has since been removed. The shipped
> transport uses a single lazily-connected session draining at
> `UPLOAD_CONCURRENCY` (8); see `services/upload-constants.ts` and
> `services/mqtt/mqtt-transport.ts`. Figures such as "Concurrency is now 32"
> and the 250 ms throttle tuning are kept verbatim as the audit record, not as
> a description of current behaviour.

Branch rebased onto `84bf51c6b perf(mobile,measurements): drop blob decompress from list render` (OJD-1537). This is a check that the rebase didn't undo the base's perf wins.

## Base wins — all preserved ✅

| Optimization                                                                           | File                                                            | Status |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------ |
| `getMeasurementsList` lean SELECT (no decompress, no Zod, SQL ORDER BY + LIMIT/OFFSET) | `shared/db/measurements-storage.ts`                             | intact |
| `useInfiniteQuery` paginated fetch (page size 50)                                      | `hooks/use-all-measurements.ts`                                 | intact |
| Modal opens via async `getMeasurement(id)` on tap                                      | `screens/recent-measurements-screen.tsx`, `completed-state.tsx` | intact |
| `deriveListColumns` at save/update time (`questionsText`, `hasComment`)                | `measurements-storage.ts`                                       | intact |
| Migration 0002 + indexes (`status`, `status_ts`, `created_at`)                         | `drizzle/0002_*.sql`                                            | intact |
| Backfill on app launch                                                                 | `_layout.tsx`                                                   | intact |
| `home-recent-measurements` uses lean `MeasurementItem`                                 | `home-recent-measurements.tsx`                                  | intact |
| `countMeasurementsByStatus` uses status index                                          | `measurements-storage.ts`                                       | intact |

## Additions on top (not regressions)

- `f839eae4d` FlashList + memoization (`SectionList → FlashList`, flat `ListRow[]`, `getItemType` recycling pools, memo'd `MeasurementsRow` + `SwipeableMeasurementRow`, `itemsById` map for stable id-based callbacks).
- `f839eae4d` 250 ms throttle for upload-settle invalidation.
- `251f7ab54` Parallel MQTT transport pool (4 sockets × 8 in-flight = 32).
- `ba12aa2cd` ErrorBoundary + global error handlers; drops `uploading` status from DB (migration 0003).

## Real unoptimizations to fix 🔧

### 1. `pages.flat()` runs every render (medium)

`hooks/use-all-measurements.ts:~88`

```ts
const measurements = listQuery.data?.pages.flat() ?? [];
```

Re-flattens N pages on every render of any consumer (screen, completed-state, home-recent). With 5 pages × 50 = 250 items, that's a 250-elem array realloc per render. Fix:

```ts
const measurements = useMemo(() => listQuery.data?.pages.flat() ?? [], [listQuery.data]);
```

### 2. `home-recent-measurements` over-fetches (medium)

`features/home/components/home-recent-measurements.tsx:~52`

```ts
const { measurements } = useAllMeasurements("all");
const top = measurements.slice(0, 3);
```

Subscribes to the full infinite list and its settle-invalidations just to show 3 rows. Also fetches the next page on `fetchNextPage` even though the home screen ignores pagination, and pays for every settle re-invalidate.

Fix: add a `useRecentMeasurementsTop(n)` hook with a single non-infinite `useQuery` calling `getMeasurementsList(..., {limit: n, offset: 0})`. Decouples home from the recent-measurements query key (or share key but `select: pages => pages[0].slice(0, n)`).

### 3. Settle-invalidate refetches all loaded pages (medium)

`hooks/use-all-measurements.ts:~80-100`

`subscribeSettled` → `queryClient.invalidateQueries({ queryKey: ["measurements"] })` re-runs the lean SELECT once per loaded page (1, 2, … N). 250 ms throttle helps but the multiplier still hurts during a burst drain of 100+ items.

Options:

- Refetch only the first page: `queryClient.invalidateQueries({ queryKey: ["measurements", "list", filter], refetchType: 'active' })` then pass `pages: 1` (TanStack v5: `setQueryData` to truncate to first page before refetch).
- Or `setQueryData` directly: for each settled id, patch row.status in the cached pages — zero SQL.

### 4. Throttle constant tuned for old concurrency (low)

`hooks/use-all-measurements.ts:12`

```ts
// Coalesce bursts of settled uploads (concurrency 8) into at most one
// refetch per 250ms — fast enough to feel real-time, cheap enough that a
// 100-item drain doesn't trigger 100 SQLite reads + decompresses.
const SETTLE_INVALIDATE_THROTTLE_MS = 250;
```

Comment mentions "100 SQLite reads + decompresses" but lean SELECT no longer decompresses. Concurrency is now 32 (4×8 MQTT pool), not 8. 250 ms may be too aggressive for the new pool — settles will arrive ~4× faster. Consider bumping to 400–500 ms during heavy drains, or making it adaptive (trailing edge wider during high settle rate). Also update the comment.

### 5. Inline objects on FlashList (cosmetic)

`screens/recent-measurements-screen.tsx:167-172`

```tsx
contentContainerStyle={{ paddingTop: 0, paddingBottom: 16 }}
ListEmptyComponent={<MeasurementsListEmpty filter={filter} />}
ListFooterComponent={<MeasurementsListFooter onExport={handleExport} isDisabled={!hasAnyMeasurements} />}
```

New object/element references every render. FlashList v2 tolerates this, but a hoisted const for `contentContainerStyle` and `useMemo` on the footer/empty elements removes spurious child reconciliation. Low priority.

## Suspicious commits (not regressions, but worth squashing/renaming before PR)

- `a59331221 format` — actually does more than format: adds tests for `use-all-measurements` and `upload-queue-state`, touches `measurements-storage` (questionsText null-safety), `upload-queue`, `upload-worker`. Rename to `test(mobile): cover upload queue state + null-safe questionsText` or split.
- `73451e606 commit` — deletes `docs/mqtt-upload-refactor.md` (346 lines), adds `shared/utils/app-lifecycle.{ts,test.ts}`, `time-sync` reshape, `upload-constants`, `upload-queue` (+44), `mqtt-publisher` (+13). Significant content; needs a real message.

## Verdict

Rebase clean. Lean-SELECT / useInfiniteQuery / on-tap-fetch chain from OJD-1537 fully preserved. Real wins to grab: memoize `pages.flat()`, fix `home-recent` over-fetch, smarter cache patch instead of full invalidate. Cosmetic: hoist FlashList inline objects, retune throttle for 32-concurrency pool, fix stale comment.
