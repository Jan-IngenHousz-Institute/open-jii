import { Inject, Injectable } from "@nestjs/common";

import type { DeviceFirmwareVersion, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

/**
 * Firmware runs over a range, oldest first: consecutive buckets of one
 * version fold into a run, so a rollback starts a new run instead of
 * vanishing into a mix. Rows without a version or window are dropped.
 */
@Injectable()
export class GetDeviceFirmwareHistoryUseCase {
  constructor(
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    thingName: string,
    from: string,
    to: string,
    bucket: MonitoringBucket,
  ): Promise<Result<DeviceFirmwareVersion[]>> {
    const result = await this.databricksPort.getDeviceFirmwareHistory(thingName, from, to, bucket);
    if (result.isFailure()) {
      return failure(result.error);
    }

    const groups = result.value
      .flatMap((row) =>
        row.version === null || row.firstSeen === null || row.lastSeen === null
          ? []
          : [
              {
                version: row.version,
                firstSeen: row.firstSeen,
                lastSeen: row.lastSeen,
                count: row.count,
              },
            ],
      )
      .sort((a, b) => new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime());

    const runs: DeviceFirmwareVersion[] = [];
    for (const group of groups) {
      const current = runs.at(-1);
      if (current?.version !== group.version) {
        runs.push(group);
        continue;
      }

      current.lastSeen = group.lastSeen > current.lastSeen ? group.lastSeen : current.lastSeen;
      current.count += group.count;
    }

    return success(runs);
  }
}
