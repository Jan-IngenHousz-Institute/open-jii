import { Inject, Injectable, Logger } from "@nestjs/common";

import type { PublicMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { METRICS_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { MetricsDatabricksPort } from "../../../core/ports/databricks.port";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";

const SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const DAILY_ACTIVITY_DAYS = 366;

interface Snapshot {
  value: PublicMetricsResponse;
  fetchedAt: number;
}

/**
 * Serves the public metrics snapshot behind an in-memory TTL cache so
 * anonymous page views never fan out to the warehouse directly. Warehouse
 * reads degrade gracefully (the tables lag one pipeline refresh and may not
 * exist before the first run); Postgres registry counts are the floor and a
 * failure there is a real error. On a failed refresh the previous snapshot
 * is served stale rather than surfacing an outage on the public page.
 */
@Injectable()
export class GetPublicMetricsUseCase {
  private readonly logger = new Logger(GetPublicMetricsUseCase.name);

  private snapshot: Snapshot | null = null;

  // Shared across concurrent callers so an expired cache on an unauthenticated
  // endpoint triggers one refresh, not one per in-flight request.
  private inFlight: Promise<Result<PublicMetricsResponse>> | null = null;

  constructor(
    @Inject(METRICS_DATABRICKS_PORT)
    private readonly databricksPort: MetricsDatabricksPort,
    private readonly metricsRepository: MetricsRepository,
  ) {}

  async execute(): Promise<Result<PublicMetricsResponse>> {
    const current = this.snapshot;
    if (current !== null && Date.now() - current.fetchedAt < SNAPSHOT_TTL_MS) {
      return success(current.value);
    }

    this.inFlight ??= this.load().finally(() => {
      this.inFlight = null;
    });
    const result = await this.inFlight;

    if (result.isSuccess()) {
      this.snapshot = { value: result.value, fetchedAt: Date.now() };
      return result;
    }

    if (this.snapshot !== null) {
      this.logger.warn({
        msg: "Public metrics refresh failed, serving stale snapshot",
        operation: "execute",
        error: result.error,
      });
      return success(this.snapshot.value);
    }

    return result;
  }

  private async load(): Promise<Result<PublicMetricsResponse>> {
    const [registryResult, totalsResult, dailyResult, familyResult] = await Promise.all([
      this.metricsRepository.getRegistryCounts(),
      this.databricksPort.getPublicPlatformTotals(),
      this.databricksPort.getPublicDailyActivity(DAILY_ACTIVITY_DAYS),
      this.databricksPort.getPublicFamilyTotals(),
    ]);

    if (registryResult.isFailure()) {
      return registryResult;
    }

    if (totalsResult.isFailure() || dailyResult.isFailure() || familyResult.isFailure()) {
      this.logger.warn({
        msg: "Warehouse metrics unavailable, serving registry counts only",
        operation: "load",
      });
    }

    return success({
      registry: registryResult.value,
      totals: totalsResult.isSuccess() ? totalsResult.value : null,
      dailyActivity: dailyResult.isSuccess() ? dailyResult.value : [],
      familyTotals: familyResult.isSuccess() ? familyResult.value : [],
    });
  }
}
