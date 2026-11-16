import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";

import type {
  ExperimentTableMetadata,
  ExperimentTablesChange,
  ExperimentTableVersion,
} from "../../core/models/experiment-data.model";
import { ExperimentDataRepository } from "../../core/repositories/experiment-data.repository";

export const CHECK_MS = 3_000;
// Well under the load balancer's 60-second idle timeout.
export const HEARTBEAT_MS = 20_000;

type WatchUpdate = { tables: ExperimentTableVersion[] } | { failed: true };
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

  constructor(private readonly experimentDataRepository: ExperimentDataRepository) {}

  async *listen(
    experimentId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ExperimentTablesChange, void> {
    const updates: WatchUpdate[] = [];
    let wake: () => void = () => undefined;
    const listener = (update: WatchUpdate) => {
      updates.push(update);
      wake();
    };
    const stop = () => wake();

    signal?.addEventListener("abort", stop);
    const watch = this.join(experimentId, listener);

    try {
      while (signal?.aborted !== true) {
        const update = updates.shift();

        if (update === undefined) {
          const isWoken = await new Promise<boolean>((resolve) => {
            const heartbeat = setTimeout(() => resolve(false), HEARTBEAT_MS);
            wake = () => {
              clearTimeout(heartbeat);
              resolve(true);
            };
          });
          if (!isWoken) {
            yield { type: "heartbeat" };
          }
          continue;
        }

        if ("failed" in update) {
          return;
        }
        yield { type: "changed", tables: update.tables };
      }
    } finally {
      signal?.removeEventListener("abort", stop);
      this.leave(experimentId, watch, listener);
    }
  }

  onModuleDestroy(): void {
    for (const watch of this.watches.values()) {
      clearTimeout(watch.timer);
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
    void this.check(experimentId, watch);
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

  private async check(experimentId: string, watch: Watch): Promise<void> {
    const result = await this.experimentDataRepository.listedTablesMetadata(experimentId, "store");
    if (this.watches.get(experimentId) !== watch) {
      return;
    }

    // Ending the streams keeps a store outage from passing for a quiet experiment.
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Store tables check failed",
        operation: "watchExperimentTables",
        experimentId,
        error: result.error.message,
      });
      this.watches.delete(experimentId);
      for (const listener of watch.listeners) {
        listener({ failed: true });
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
