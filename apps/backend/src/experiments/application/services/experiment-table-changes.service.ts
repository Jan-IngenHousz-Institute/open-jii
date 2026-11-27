import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

import { AppError, failure, success, tryCatch } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  ExperimentTableMetadata,
  ExperimentTablesChange,
  ExperimentTableVersion,
} from "../../core/models/experiment-data.model";
import { SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
import { ExperimentDataRepository } from "../../core/repositories/experiment-data.repository";

export const CHECK_MS = 3_000;
// The change check sees new rows, payload schemas and metadata sheets, not a delete or a flow edit,
// so the listing is still read in full this often.
export const FULL_LISTING_MS = 60_000;
export const HEARTBEAT_MS = 20_000;
// A stream ends after its lifetime so its client reconnects through the access check and the
// store flag, and spreads over the tasks running then.
export const STREAM_LIFETIME_MS = 10 * 60_000;
export const STREAM_LIFETIME_JITTER_MS = 60_000;
// Sized for a field team: a few tabs per person, a few dozen experiments and a few hundred streams
// per task. Each stream holds a response, a listener and a timer, and checks access as it sends.
export const MAX_STREAMS_PER_USER = 10;
export const MAX_WATCHED_EXPERIMENTS = 50;
export const MAX_STREAMS_PER_TASK = 200;

type WatchUpdate = { tables: ExperimentTableVersion[] } | { ended: true };
type Listener = (update: WatchUpdate) => void;

interface Watch {
  listeners: Set<Listener>;
  tables: ExperimentTableVersion[] | null;
  revision: string | null;
  timer: NodeJS.Timeout | undefined;
  markSince: string | null;
  markRevision: string | null;
  listedAt: number;
}

/**
 * Follows the store's tables listing of each experiment someone listens to, with one check per
 * task however many listen, and tells every listener when it changes. A check reads the listing
 * only once the store's change mark moved, since the listing counts every row.
 */
@Injectable()
export class ExperimentTableChangesService implements OnModuleDestroy {
  private readonly logger = new Logger(ExperimentTableChangesService.name);
  private readonly watches = new Map<string, Watch>();
  private readonly streamsPerUser = new Map<string, number>();
  private streamCount = 0;
  // Checks outlive the request that started them, so they run outside its logging context.
  private readonly runOutsideRequest = AsyncLocalStorage.snapshot();

  constructor(
    private readonly experimentDataRepository: ExperimentDataRepository,
    @Inject(SERVING_STORE_PORT) private readonly store: ServingStorePort,
  ) {}

  open(
    experimentId: string,
    userId: string,
    mayRead: () => Promise<boolean>,
    signal?: AbortSignal,
  ): Result<AsyncGenerator<ExperimentTablesChange, void>> {
    const isUserAtCap = (this.streamsPerUser.get(userId) ?? 0) >= MAX_STREAMS_PER_USER;
    if (isUserAtCap) {
      return failure(AppError.tooManyRequests("Too many open table change streams"));
    }

    const isTaskAtStreamCap = this.streamCount >= MAX_STREAMS_PER_TASK;
    if (isTaskAtStreamCap) {
      return failure(AppError.unavailable("Too many table change streams on this task"));
    }

    const isTaskAtExperimentCap =
      !this.watches.has(experimentId) && this.watches.size >= MAX_WATCHED_EXPERIMENTS;
    if (isTaskAtExperimentCap) {
      return failure(AppError.unavailable("Too many experiments followed on this task"));
    }

    let pending: WatchUpdate | undefined;
    let wake: () => void = () => undefined;
    const listener: Listener = (update) => {
      const isEnding = pending !== undefined && "ended" in pending;
      if (!isEnding) {
        pending = update;
      }
      wake();
    };

    const watch = this.join(experimentId, listener);
    this.streamsPerUser.set(userId, (this.streamsPerUser.get(userId) ?? 0) + 1);
    this.streamCount += 1;

    const endsAt = Date.now() + STREAM_LIFETIME_MS + Math.random() * STREAM_LIFETIME_JITTER_MS;
    let isClosed = false;
    const close = () => {
      if (isClosed) {
        return;
      }
      isClosed = true;
      clearTimeout(lifetime);
      this.leave(experimentId, watch, listener);
      this.releaseStream(userId);
      wake();
    };
    // A reader that stops pulling never reaches a deadline check, so its slots are given back here.
    const lifetime = setTimeout(close, endsAt - Date.now());
    // Covers a request that aborts before its stream is first read, or already has: oRPC ends an
    // unread generator without running its `finally`.
    signal?.addEventListener("abort", close, { once: true });
    if (signal?.aborted) {
      close();
    }

    const wait = (ms: number) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), ms);
        wake = () => {
          clearTimeout(timer);
          resolve(true);
        };
      });

    // The lifetime holds with a change waiting too, so a slow reader cannot outlast it.
    const isOpen = () => {
      const isEnded = pending !== undefined && "ended" in pending;
      return !isClosed && !isEnded && Date.now() < endsAt;
    };
    // The route checks access only as a stream opens, so the stream asks again before every send.
    // How long an answer holds is the check's to say, so one stream's answer is never held longer.
    const canSend = async (): Promise<boolean> => {
      if (!isOpen()) {
        return false;
      }

      const mayStillRead = await this.mayStillRead(experimentId, mayRead);
      return mayStillRead && isOpen();
    };

    async function* changes(): AsyncGenerator<ExperimentTablesChange, void> {
      try {
        while (isOpen()) {
          if (pending === undefined) {
            const isWoken = await wait(Math.min(HEARTBEAT_MS, endsAt - Date.now()));
            if (isWoken) {
              continue;
            }
            if (!(await canSend())) {
              return;
            }
            yield { type: "heartbeat" };
            continue;
          }

          if (!(await canSend())) {
            return;
          }
          // Taken after the check, so the newest change goes out.
          const update = pending;
          pending = undefined;
          if ("ended" in update) {
            return;
          }
          yield { type: "changed", tables: update.tables };
        }
      } finally {
        close();
      }
    }

    return success(changes());
  }

  onModuleDestroy(): void {
    for (const watch of this.watches.values()) {
      clearTimeout(watch.timer);
      for (const listener of watch.listeners) {
        listener({ ended: true });
      }
    }
    this.watches.clear();
  }

  private join(experimentId: string, listener: Listener): Watch {
    const watch = this.watches.get(experimentId) ?? this.startWatch(experimentId);
    watch.listeners.add(listener);

    if (watch.tables !== null) {
      listener({ tables: watch.tables });
    }
    return watch;
  }

  private startWatch(experimentId: string): Watch {
    const watch: Watch = {
      listeners: new Set(),
      tables: null,
      revision: null,
      timer: undefined,
      markSince: null,
      markRevision: null,
      listedAt: Number.NEGATIVE_INFINITY,
    };
    this.watches.set(experimentId, watch);
    this.runOutsideRequest(() => void this.check(experimentId, watch));
    return watch;
  }

  private leave(experimentId: string, watch: Watch, listener: Listener): void {
    watch.listeners.delete(listener);

    const isLastListener = watch.listeners.size === 0 && this.watches.get(experimentId) === watch;
    if (isLastListener) {
      clearTimeout(watch.timer);
      this.watches.delete(experimentId);
    }
  }

  private async mayStillRead(
    experimentId: string,
    mayRead: () => Promise<boolean>,
  ): Promise<boolean> {
    const result = await tryCatch(mayRead);
    if (result.isSuccess()) {
      return result.value;
    }

    this.logger.warn({
      msg: "Access check failed",
      operation: "watchExperimentTables",
      experimentId,
      error: result.error.message,
    });
    return false;
  }

  private releaseStream(userId: string): void {
    this.streamCount -= 1;
    const count = (this.streamsPerUser.get(userId) ?? 0) - 1;
    if (count > 0) {
      this.streamsPerUser.set(userId, count);
    } else {
      this.streamsPerUser.delete(userId);
    }
  }

  private async check(experimentId: string, watch: Watch): Promise<void> {
    const result = await this.movedListing(experimentId, watch);
    const isSuperseded = this.watches.get(experimentId) !== watch;
    if (isSuperseded) {
      return;
    }

    // Ending the streams keeps an outage from passing for a quiet experiment.
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Tables check failed",
        operation: "watchExperimentTables",
        experimentId,
        error: result.error.message,
      });
      this.watches.delete(experimentId);
      for (const listener of watch.listeners) {
        listener({ ended: true });
      }
      return;
    }

    const listing = result.value;
    if (listing === null) {
      watch.timer = setTimeout(() => void this.check(experimentId, watch), CHECK_MS);
      return;
    }

    const tables = listing
      .map((table) => this.versionOf(table))
      .sort((a, b) => a.identifier.localeCompare(b.identifier));
    const revision = JSON.stringify(tables);

    if (revision !== watch.revision) {
      watch.revision = revision;
      watch.tables = tables;
      for (const listener of watch.listeners) {
        listener({ tables });
      }
    }

    watch.timer = setTimeout(() => void this.check(experimentId, watch), CHECK_MS);
  }

  /** The listing, or null when the store's change mark has not moved and no full read is due. */
  private async movedListing(
    experimentId: string,
    watch: Watch,
  ): Promise<Result<ExperimentTableMetadata[] | null>> {
    const mark = await this.store.getExperimentChangeMark(experimentId, watch.markSince);
    if (mark.isFailure()) {
      return mark;
    }

    const { revision, next } = mark.value;
    const isFullListingDue = Date.now() - watch.listedAt >= FULL_LISTING_MS;
    const hasMoved = revision !== watch.markRevision || isFullListingDue;
    // Each listing moves the mark's start up, so a watch counts only recent rows. The later start's
    // count, read with this one, is what the next mark is compared with, and the listing reads after.
    const counted = hasMoved ? next : mark.value;
    watch.markSince = counted.since;
    watch.markRevision = counted.revision;
    if (!hasMoved) {
      return success(null);
    }

    watch.listedAt = Date.now();
    return this.experimentDataRepository.listTablesAfresh(experimentId, "store");
  }

  private versionOf(table: ExperimentTableMetadata): ExperimentTableVersion {
    return {
      identifier: table.identifier,
      displayName: table.displayName,
      totalRows: table.rowCount,
      latestRowAt: table.latestRowAt,
      schemaRevision: table.schemaRevision,
      contentRevision: table.contentRevision ?? null,
    };
  }
}
