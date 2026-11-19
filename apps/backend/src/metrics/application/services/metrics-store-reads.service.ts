import { Inject, Injectable } from "@nestjs/common";

import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import { MetricsTable } from "../../core/models/metrics-table.model";
import type {
  ActivityWindowsRow,
  ContributorPairRow,
  DailyActivityRow,
  DatabricksPort,
  DevicePairRow,
  FamilyTotalsRow,
  HourlyActivityRow,
  ParameterCategory,
  ParameterStatsRow,
  PlatformTotalsRow,
  PoolFactsRow,
  ResourceDailyRow,
  ScopedDailyRow,
} from "../../core/ports/databricks.port";
import { METRICS_SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
import { MetricsRepository } from "../../core/repositories/metrics.repository";

/** The pipeline's family for a client without a registered device, or rows without a client. */
const UNATTRIBUTED_FAMILY = "unattributed";

/**
 * Reads through the serving store's metrics views, in the warehouse tables' rows. The store counts
 * families per publishing client, so each client's family is filled from the registry in Postgres.
 */
@Injectable()
export class MetricsStoreReadsService implements DatabricksPort {
  constructor(
    @Inject(METRICS_SERVING_STORE_PORT) private readonly store: ServingStorePort,
    private readonly metricsRepository: MetricsRepository,
  ) {}

  getPublicPlatformTotals(): Promise<Result<PlatformTotalsRow | null>> {
    return this.store.getPublicPlatformTotals();
  }

  getPublicDailyActivity(days: number): Promise<Result<DailyActivityRow[]>> {
    return this.store.getPublicDailyActivity(days);
  }

  /** Each client's count under its device's family in the registry, as the pipeline joins them. */
  async getPublicFamilyTotals(): Promise<Result<FamilyTotalsRow[]>> {
    const clients = await this.store.getClientTotals();
    if (clients.isFailure()) {
      return clients;
    }

    const thingNames = clients.value.flatMap(({ clientId }) =>
      clientId === null ? [] : [clientId],
    );
    const deviceTypes = await this.metricsRepository.getDeviceTypeMapForThingNames(thingNames);
    if (deviceTypes.isFailure()) {
      return deviceTypes;
    }

    const families = new Map<string, number>();
    for (const { clientId, measurements } of clients.value) {
      const family =
        clientId === null
          ? UNATTRIBUTED_FAMILY
          : (deviceTypes.value.get(clientId) ?? UNATTRIBUTED_FAMILY);
      families.set(family, (families.get(family) ?? 0) + measurements);
    }

    const totals = Array.from(families, ([family, measurements]) => ({ family, measurements }));
    return success(MetricsTable.byMeasurements(totals));
  }

  getActivityWindows(): Promise<Result<ActivityWindowsRow | null>> {
    return this.store.getActivityWindows();
  }

  getHourlyActivity(): Promise<Result<HourlyActivityRow[]>> {
    return this.store.getHourlyActivity();
  }

  getTopParameter(category: ParameterCategory): Promise<Result<ParameterStatsRow | null>> {
    return this.store.getTopParameter(category);
  }

  getPoolFacts(): Promise<Result<PoolFactsRow | null>> {
    return this.store.getPoolFacts();
  }

  getScopedDailyActivity(days: number): Promise<Result<ScopedDailyRow[]>> {
    return this.store.getScopedDailyActivity(days);
  }

  getResourceDailyActivity(
    resourceType: string,
    days: number,
  ): Promise<Result<ResourceDailyRow[]>> {
    return this.store.getResourceDailyActivity(resourceType, days);
  }

  getContributorPairs(): Promise<Result<ContributorPairRow[]>> {
    return this.store.getContributorPairs();
  }

  getDevicePairs(): Promise<Result<DevicePairRow[]>> {
    return this.store.getDevicePairs();
  }
}
