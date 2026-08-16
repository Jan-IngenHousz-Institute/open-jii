import { Inject, Injectable } from "@nestjs/common";

import type { DeviceFirmwareVersion } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

/**
 * The firmware versions one thing reported over a range, oldest first. Rows
 * that never carried a version, or whose window the warehouse could not
 * resolve, are dropped: a transition can only be stated between two known
 * versions at a known time.
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
  ): Promise<Result<DeviceFirmwareVersion[]>> {
    const result = await this.databricksPort.getDeviceFirmwareHistory(thingName, from, to);
    if (result.isFailure()) {
      return failure(result.error);
    }

    const versions = result.value.flatMap((row) =>
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
    );

    return success(
      versions.sort((a, b) => new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime()),
    );
  }
}
