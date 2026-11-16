import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  ExperimentTableMetadata,
  ExperimentTablesChange,
  ExperimentTableVersion,
} from "../../core/models/experiment-data.model";
import { ExperimentDataRepository } from "../../core/repositories/experiment-data.repository";

export const CHECK_MS = 3_000;
export const HEARTBEAT_MS = 20_000;
// A stream ends after its lifetime so its client reconnects through the access check and the
// store flag, and spreads over the tasks running then.
export const STREAM_LIFETIME_MS = 10 * 60_000;
export const STREAM_LIFETIME_JITTER_MS = 60_000;
// Sized for a field team: a few tabs per person, a few dozen experiments per task.
export const MAX_STREAMS_PER_USER = 10;
export const MAX_WATCHED_EXPERIMENTS = 50;

type WatchUpdate = { tables: ExperimentTableVersion[] } | { ended: true };
type Listener = (update: WatchUpdate) => void;

interface Watch {
  listeners: Set<Listener>;
  tables: ExperimentTableVersion[] | null;
  revision: string | null;
  timer: NodeJS.Timeout | undefined;
}

/**
 * Follows the store's tables listing of each experiment someone listens to, with one check per
 * task however many listen, and tells every listener when it changes.
 */
@Injectable()
export class ExperimentTableChangesService implements OnModuleDestroy {
  private readonly logger = new Logger(ExperimentTableChangesService.name);
  private readonly watches = new Map<string, Watch>();
  private readonly streamsPerUser = new Map<string, number>();
  // Checks outlive the request that started them, so they run outside its logging context.
  private readonly runOutsideRequest = AsyncLocalStorage.snapshot();

  constructor(private readonly experimentDataRepository: ExperimentDataRepository) {}

  open(
    experimentId: string,
    userId: string,
    signal?: AbortSignal,
  ): Result<AsyncGenerator<ExperimentTablesChange, void>> {
    const isUserAtCap = (this.streamsPerUser.get(userId) ?? 0) >= MAX_STREAMS_PER_USER;
    if (isUserAtCap) {
      return failure(AppError.tooManyRequests("Too many open table change streams"));
    }

    const isTaskAtCap =
      !this.watches.has(experimentId) && this.watches.size >= MAX_WATCHED_EXPERIMENTS;
    if (isTaskAtCap) {
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

    let isClosed = false;
    const close = () => {
      if (isClosed) {
        return;
      }
      isClosed = true;
      this.leave(experimentId, watch, listener);
      this.releaseStream(userId);
      wake();
    };
    // Covers a request that aborts before its stream is first read.
    signal?.addEventListener("abort", close, { once: true });

    const wait = (ms: number) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), ms);
        wake = () => {
          clearTimeout(timer);
          resolve(true);
        };
      });
    const endsAt = Date.now() + STREAM_LIFETIME_MS + Math.random() * STREAM_LIFETIME_JITTER_MS;

    async function* changes(): AsyncGenerator<ExperimentTablesChange, void> {
      try {
        while (!isClosed) {
          const update = pending;
          pending = undefined;

          if (update === undefined) {
            const untilEnd = endsAt - Date.now();
            if (untilEnd <= 0) {
              return;
            }
            const isWoken = await wait(Math.min(HEARTBEAT_MS, untilEnd));
            const isHeartbeatDue = !isWoken && Date.now() < endsAt;
            if (isHeartbeatDue) {
              yield { type: "heartbeat" };
            }
            continue;
          }

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
    const watch: Watch = { listeners: new Set(), tables: null, revision: null, timer: undefined };
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

  private releaseStream(userId: string): void {
    const count = (this.streamsPerUser.get(userId) ?? 0) - 1;
    if (count > 0) {
      this.streamsPerUser.set(userId, count);
    } else {
      this.streamsPerUser.delete(userId);
    }
  }

  private async check(experimentId: string, watch: Watch): Promise<void> {
    const result = await this.experimentDataRepository.listedTablesMetadata(experimentId, "store");
    if (this.watches.get(experimentId) !== watch) {
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

    const tables = result.value
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

  private versionOf(table: ExperimentTableMetadata): ExperimentTableVersion {
    return {
      identifier: table.identifier,
      totalRows: table.rowCount,
      latestRowAt: table.latestRowAt,
      schemaRevision: table.schemaRevision,
    };
  }
}
