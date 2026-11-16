import { Injectable } from "@nestjs/common";

import type { DeviceFirmwareVersion, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import type { DeviceDataSource } from "../../../core/models/device-data.model";
import { DeviceDataSourceService } from "../../services/device-data-source.service";

/**
 * Firmware runs over a range, oldest first: consecutive buckets of one
 * version fold into a run, so a rollback starts a new run instead of
 * vanishing into a mix. Rows without a version or window are dropped.
 */
@Injectable()
export class GetDeviceFirmwareHistoryUseCase {
  constructor(private readonly dataSource: DeviceDataSourceService) {}

  async execute(
    thingName: string,
    from: string,
    to: string,
    bucket: MonitoringBucket,
    source: DeviceDataSource,
  ): Promise<Result<DeviceFirmwareVersion[]>> {
    const result = await this.dataSource
      .reads(source)
      .getDeviceFirmwareHistory(thingName, from, to, bucket);
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
