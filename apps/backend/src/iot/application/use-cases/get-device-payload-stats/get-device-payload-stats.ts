import { Inject, Injectable } from "@nestjs/common";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

interface MixEntry {
  key: string | null;
  count: number;
}

type WorkbookMixEntry = DevicePayloadStats["workbookMix"][number];

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
    private readonly workbookVersionRepository: WorkbookVersionRepository,
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
    const versionMix = this.sumMix(
      rows.map((row) => ({ key: row.workbookVersionId, count: row.count })),
    );
    const workbookMixResult = await this.attributeWorkbooks(versionMix);
    if (workbookMixResult.isFailure()) {
      return failure(workbookMixResult.error);
    }
    const workbookMix = workbookMixResult.value;

    // Already grouped in SQL; the fold only orders it, busiest first.
    const macroMix = this.sumMix(
      macroResult.value.map((row) => ({ key: row.macroId, count: row.count })),
    ).map((entry) => ({ macroId: entry.key, count: entry.count }));

    return success({ ...totals, workbookRuns, firmwareMix, protocolMix, workbookMix, macroMix });
  }

  /**
   * A device reports the workbook VERSION it ran. Attributing that to its
   * workbook is a registry lookup, not something the warehouse can answer, and
   * without it a caller has an id that matches no workbook it can list.
   */
  private async attributeWorkbooks(entries: MixEntry[]): Promise<Result<WorkbookMixEntry[]>> {
    const versionIds = entries.flatMap((entry) => (entry.key === null ? [] : [entry.key]));
    const refsResult = await this.workbookVersionRepository.findWorkbookRefsByIds(versionIds);
    if (refsResult.isFailure()) {
      return failure(refsResult.error);
    }

    const byVersionId = new Map(refsResult.value.map((ref) => [ref.id, ref]));

    return success(
      entries.map((entry) => {
        const ref = entry.key === null ? undefined : byVersionId.get(entry.key);
        return {
          workbookVersionId: entry.key,
          workbookId: ref?.workbookId ?? null,
          workbookVersion: ref?.version ?? null,
          count: entry.count,
        };
      }),
    );
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
