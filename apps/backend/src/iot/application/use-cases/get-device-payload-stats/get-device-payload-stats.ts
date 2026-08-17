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
 * Payload profile of a range. Everything but the macros folds from one
 * grouped scan; macros need their own, being an array column that only
 * expands into countable rows once exploded.
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

    // Distinct runs, not row counts: a run can span several combinations.
    const workbookRuns = new Set(
      rows.flatMap((row) => (row.workbookRunId === null ? [] : [row.workbookRunId])),
    ).size;

    const firmwareMix = this.sumMix(
      rows.map((row) => ({ key: row.deviceVersion, count: row.count })),
    ).map((entry) => ({ version: entry.key, count: entry.count }));

    // The null group is every modern (lean-topic) row; it would drown the mix.
    const protocolMix = this.sumMix(
      rows.flatMap((row) =>
        row.protocolId === null ? [] : [{ key: row.protocolId, count: row.count }],
      ),
    ).map((entry) => ({ protocolId: entry.key, count: entry.count }));

    // Null kept: "sent outside any workbook" is a real answer here.
    const workbookMix = this.sumMix(
      rows.map((row) => ({ key: row.workbookVersionId, count: row.count })),
    ).map((entry) => ({ workbookVersionId: entry.key, count: entry.count }));

    // Already grouped in SQL; the fold only orders it, busiest first.
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
