"use client";

import { findWorkbookCell } from "@repo/api/transforms/workbook-cell-tree";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import type { ParallelLaneAttempt, RunnerState, TrackStatus } from "@repo/workbook";

interface ParallelTrackBoardProps {
  state: Readonly<RunnerState> | null;
  onAbandon: (trackId: string) => void;
  onRestart?: (containerCellId: string, attemptId: string) => void;
}

const TERMINAL = new Set<TrackStatus>(["done", "partial", "failed", "skipped"]);

function statusOf(state: Readonly<RunnerState>, lane: ParallelLaneAttempt): TrackStatus {
  if (lane.trackId === null || !Object.prototype.hasOwnProperty.call(state.tracks, lane.trackId)) {
    return lane.status;
  }
  return state.tracks[lane.trackId].status;
}

/** Live, track-local presentation; aggregate runner status can hide a waiting lane. */
export function ParallelTrackBoard({ state, onAbandon, onRestart }: ParallelTrackBoardProps) {
  if (!state) return null;
  const attempts = Object.values(state.parallelAttempts).filter(
    (attempt): attempt is NonNullable<typeof attempt> => attempt !== undefined,
  );
  const attempt =
    (state.activeContainerAttemptId
      ? state.parallelAttempts[state.activeContainerAttemptId]
      : undefined) ?? attempts.at(-1);
  if (!attempt) return null;

  const deviceLabels = new Map(state.devices.map((device) => [device.id, device.label]));
  return (
    <section aria-label="Parallel lane tracks" className="mb-4 rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Parallel run</p>
          <p className="text-muted-foreground text-xs">Attempt {attempt.attemptId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{attempt.status}</Badge>
          {attempt.status === "awaitingRestart" && onRestart && (
            <Button size="sm" onClick={() => onRestart(attempt.containerCellId, attempt.attemptId)}>
              Restart lanes
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {Object.values(attempt.lanes).map((lane) => {
          const status = statusOf(state, lane);
          const track = lane.trackId ? state.tracks[lane.trackId] : undefined;
          const current = track?.cursor.cellId
            ? findWorkbookCell(state.cells, track.cursor.cellId)?.cell
            : undefined;
          const canAbandon = track !== undefined && !TERMINAL.has(status);
          const abandonTrackId = canAbandon ? lane.trackId : null;
          return (
            <div
              key={lane.laneId}
              className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-36 flex-1">
                <p className="text-sm font-medium">{lane.label || lane.laneId}</p>
                <p className="text-muted-foreground text-xs">
                  {lane.deviceIds.length > 0
                    ? lane.deviceIds.map((id) => deviceLabels.get(id) ?? id).join(", ")
                    : "No devices assigned"}
                </p>
              </div>
              <div className="min-w-28 text-xs">
                <p>{current ? current.type : "—"}</p>
                {current && <p className="text-muted-foreground truncate">{current.id}</p>}
              </div>
              <Badge variant="secondary">{status}</Badge>
              {abandonTrackId && (
                <Button variant="outline" size="sm" onClick={() => onAbandon(abandonTrackId)}>
                  Abandon
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
