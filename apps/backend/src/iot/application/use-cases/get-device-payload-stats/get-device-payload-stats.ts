import { Inject, Injectable } from "@nestjs/common";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

interface MixEntry {
  key: string | null;
  count: number;
}

/**
 * Payload-content profile of a device's measurements over a range: metadata
 * coverage, firmware mix, protocol mix (legacy-topic rows only), distinct
 * workbook runs, and the macros that ran. Everything but the macros folds
 * from one grouped scan; macros need their own, since the column is an array
 * and only expands into countable rows once exploded.
 */
@Injectable()
export class GetDevicePayloadStatsUseCase {
  constructor(
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(thingName: string, from: string, to: string): Promise<Result<DevicePayloadStats>> {
    const [result, macroResult] = await Promise.all([
      this.databricksPort.getDevicePayloadBreakdown(thingName, from, to),
      this.databricksPort.getDeviceMacroBreakdown(thingName, from, to),
    ]);
    if (result.isFailure()) {
      return failure(result.error);
    }
    if (macroResult.isFailure()) {
      return failure(macroResult.error);
    }

    const rows = result.value;

    const totals = rows.reduce(
      (acc, row) => ({
        totalMeasurements: acc.totalMeasurements + row.count,
        withGps: acc.withGps + row.withGps,
        withBattery: acc.withBattery + row.withBattery,
      }),
      { totalMeasurements: 0, withGps: 0, withBattery: 0 },
    );

    // Distinct runs, not row counts: a run can span several firmware/protocol
    // combinations; null marks rows outside any workbook run.
    const workbookRuns = new Set(
      rows.flatMap((row) => (row.workbookRunId === null ? [] : [row.workbookRunId])),
    ).size;

    const firmwareMix = this.sumMix(
      rows.map((row) => ({ key: row.deviceVersion, count: row.count })),
    ).map((entry) => ({ version: entry.key, count: entry.count }));

    // Protocol attribution only exists on legacy-topic rows; the null group is
    // every modern row and would drown the mix, so it is dropped, not shown.
    const protocolMix = this.sumMix(
      rows.flatMap((row) =>
        row.protocolId === null ? [] : [{ key: row.protocolId, count: row.count }],
      ),
    ).map((entry) => ({ protocolId: entry.key, count: entry.count }));

    // Workbook attribution is absent on ad-hoc measurements, so the null group
    // is kept: "sent outside any workbook" is a real answer here.
    const workbookMix = this.sumMix(
      rows.map((row) => ({ key: row.workbookVersionId, count: row.count })),
    ).map((entry) => ({ workbookVersionId: entry.key, count: entry.count }));

    // Already grouped by macro id in SQL; the fold only orders it like its
    // siblings, so the busiest macro leads.
    const macroMix = this.sumMix(
      macroResult.value.map((row) => ({ key: row.macroId, count: row.count })),
    ).map((entry) => ({ macroId: entry.key, count: entry.count }));

    return success({ ...totals, workbookRuns, firmwareMix, protocolMix, workbookMix, macroMix });
  }

  private sumMix(entries: MixEntry[]): MixEntry[] {
    const totals = new Map<string | null, number>();
    for (const entry of entries) {
      totals.set(entry.key, (totals.get(entry.key) ?? 0) + entry.count);
    }

    return [...totals.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }
}
