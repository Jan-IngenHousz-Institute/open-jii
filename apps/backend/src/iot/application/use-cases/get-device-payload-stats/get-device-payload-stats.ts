import { Inject, Injectable } from "@nestjs/common";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

/**
 * Payload-content profile of a device's measurements over a range: metadata
 * coverage, firmware mix, protocol mix (legacy-topic rows only), and distinct
 * workbook runs.
 */
@Injectable()
export class GetDevicePayloadStatsUseCase {
  constructor(
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(thingName: string, from: string, to: string): Promise<Result<DevicePayloadStats>> {
    const [coverageResult, firmwareResult, protocolResult, workbookResult] = await Promise.all([
      this.databricksPort.getDevicePayloadCoverage(thingName, from, to),
      this.databricksPort.getDevicePayloadMix(thingName, from, to, "device_version"),
      this.databricksPort.getDevicePayloadMix(thingName, from, to, "protocol_id"),
      this.databricksPort.getDevicePayloadMix(thingName, from, to, "workbook_run_id"),
    ]);
    if (coverageResult.isFailure()) {
      return failure(coverageResult.error);
    }
    if (firmwareResult.isFailure()) {
      return failure(firmwareResult.error);
    }
    if (protocolResult.isFailure()) {
      return failure(protocolResult.error);
    }
    if (workbookResult.isFailure()) {
      return failure(workbookResult.error);
    }

    const totals = coverageResult.value.reduce(
      (acc, day) => ({
        totalMeasurements: acc.totalMeasurements + day.total,
        withGps: acc.withGps + day.withGps,
        withBattery: acc.withBattery + day.withBattery,
      }),
      { totalMeasurements: 0, withGps: 0, withBattery: 0 },
    );

    // Distinct runs = number of non-null groups; null groups are rows outside
    // any workbook run.
    const workbookRuns = workbookResult.value.filter((group) => group.value !== null).length;

    return success({
      ...totals,
      workbookRuns,
      firmwareMix: firmwareResult.value
        .map((group) => ({ version: group.value, count: group.count }))
        .sort((a, b) => b.count - a.count),
      protocolMix: protocolResult.value
        .filter((group) => group.value !== null)
        .map((group) => ({ protocolId: group.value, count: group.count }))
        .sort((a, b) => b.count - a.count),
    });
  }
}
