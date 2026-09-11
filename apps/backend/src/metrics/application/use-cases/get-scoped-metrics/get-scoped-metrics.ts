import { Inject, Injectable, Logger } from "@nestjs/common";

import type { MetricsScope, ScopedMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { CACHE_PORT, CachePort } from "../../../core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type {
  ActivityWindowsRow,
  ContributorPairRow,
  DatabricksPort,
  ScopedDailyRow,
} from "../../../core/ports/databricks.port";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";

const WINDOW_DAYS = 30;

// Two windows in one read: every figure is stated against the previous one.
const LOADED_DAYS = WINDOW_DAYS * 2;

/**
 * One shared key: the warehouse inputs are scope-independent, so per-caller
 * keys would multiply identical platform-wide reads and accumulate without
 * bound in the in-memory store.
 */
export const SCOPED_INPUTS_CACHE_KEY = "scoped-inputs";

interface ScopedInputs {
  daily: ScopedDailyRow[];
  contributorPairs: ContributorPairRow[];
  windows: ActivityWindowsRow;
}

/**
 * Org- and user-scoped activity: per-experiment warehouse rows are joined
 * against Postgres ownership/grants here, aggregated to the requested scope,
 * and served with the platform baseline for comparison. The experiment- and
 * user-grain inputs never leave this use case unaggregated.
 */
@Injectable()
export class GetScopedMetricsUseCase {
  private readonly logger = new Logger(GetScopedMetricsUseCase.name);

  constructor(
    @Inject(METRICS_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
    @Inject(CACHE_PORT)
    private readonly cachePort: CachePort,
    private readonly metricsRepository: MetricsRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    scope: MetricsScope,
    userId: string,
    organizationId?: string,
    experimentId?: string,
  ): Promise<Result<ScopedMetricsResponse>> {
    const scopeIds = await this.resolveScopeIds(scope, userId, organizationId, experimentId);
    if (scopeIds.isFailure()) {
      return failure(scopeIds.error);
    }

    const inputs = await this.cachePort.tryCache(SCOPED_INPUTS_CACHE_KEY, () => this.loadInputs());

    if (inputs === null) {
      // A lagging or absent warehouse degrades to empty slots. Nothing is
      // cached, so the next request retries instead of pinning the outage.
      return success({ scope, scoped: null, baseline: null, computedAt: null });
    }

    return success(this.aggregate(scope, new Set(scopeIds.value), inputs));
  }

  /** Refused before any cached figure is touched, so a revoked caller reads nothing. */
  private async resolveScopeIds(
    scope: MetricsScope,
    userId: string,
    organizationId: string | undefined,
    experimentId: string | undefined,
  ): Promise<Result<string[]>> {
    if (scope === "experiment") {
      if (experimentId === undefined) {
        return failure(AppError.badRequest("experimentId is required for experiment scope"));
      }

      const access = await this.authz.can(userId, {
        resourceType: "experiment",
        resourceId: experimentId,
        action: "read",
      });
      if (!access.allow) {
        return failure(
          access.reason === "not-found"
            ? AppError.notFound(`Experiment with ID ${experimentId} not found`)
            : AppError.forbidden("You do not have access to this experiment"),
        );
      }

      return success([experimentId]);
    }

    if (scope === "organization") {
      if (organizationId === undefined) {
        return failure(AppError.badRequest("organizationId is required for organization scope"));
      }

      const membership = await this.metricsRepository.isOrganizationMember(userId, organizationId);
      if (membership.isFailure()) {
        return membership;
      }
      if (!membership.value) {
        return failure(AppError.forbidden("Not a member of this organization"));
      }

      return this.metricsRepository.getOrganizationExperimentIds(organizationId);
    }

    return this.metricsRepository.getUserExperimentIds(userId);
  }

  private async loadInputs(): Promise<ScopedInputs | null> {
    const [scopedDaily, contributorPairs, windows] = await Promise.all([
      this.databricksPort.getScopedDailyActivity(LOADED_DAYS),
      this.databricksPort.getContributorPairs(),
      this.databricksPort.getActivityWindows(),
    ]);

    if (
      scopedDaily.isFailure() ||
      contributorPairs.isFailure() ||
      windows.isFailure() ||
      windows.value === null
    ) {
      this.logger.warn({
        msg: "Warehouse unavailable for scoped metrics",
        operation: "loadInputs",
      });
      return null;
    }

    return {
      daily: scopedDaily.value,
      contributorPairs: contributorPairs.value,
      windows: windows.value,
    };
  }

  private aggregate(
    scope: MetricsScope,
    scopeIds: Set<string>,
    inputs: ScopedInputs,
  ): ScopedMetricsResponse {
    const previousDates = new Set(this.windowDates(1));

    const byDate = new Map<string, number>();
    const activeExperiments = new Set<string>();
    let previousMeasurements = 0;

    for (const row of inputs.daily) {
      if (!scopeIds.has(row.experimentId)) {
        continue;
      }

      if (previousDates.has(row.date)) {
        previousMeasurements += row.measurements;
        continue;
      }

      activeExperiments.add(row.experimentId);
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.measurements);
    }

    // Silent days keep a zero, so the series is read by its shape.
    const activity = this.windowDates().map((date) => ({
      date,
      measurements: byDate.get(date) ?? 0,
    }));
    const activeDays = activity.filter((day) => day.measurements > 0);

    const peak = activeDays.reduce<{ date: string; measurements: number } | null>(
      (best, day) => (best === null || day.measurements > best.measurements ? day : best),
      null,
    );

    const contributors = new Set(
      inputs.contributorPairs
        .filter((pair) => scopeIds.has(pair.experimentId))
        .map((pair) => pair.userId),
    ).size;

    return {
      scope,
      scoped: {
        measurements30d: activity.reduce((sum, day) => sum + day.measurements, 0),
        activeExperiments30d: activeExperiments.size,
        contributors30d: contributors,
        activity,
        previousMeasurements,
        activeDays: activeDays.length,
        peak,
        lastActivityDate: activeDays.length > 0 ? activeDays[activeDays.length - 1].date : null,
      },
      baseline: {
        measurements30d: inputs.windows.measurements30d,
        activeExperiments30d: inputs.windows.experiments30d,
      },
      computedAt: inputs.windows.computedAt,
    };
  }

  /** Day keys oldest first; offset 1 is the window immediately before the current one. */
  private windowDates(offset = 0): string[] {
    const dayMs = 24 * 60 * 60 * 1000;
    const end = Date.now() - offset * WINDOW_DAYS * dayMs;

    return Array.from({ length: WINDOW_DAYS }, (_, index) =>
      new Date(end - (WINDOW_DAYS - 1 - index) * dayMs).toISOString().slice(0, 10),
    );
  }
}
