import { Inject, Injectable } from "@nestjs/common";

import type { DeviceThroughputBucket, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

/**
 * Measurement counts per time bucket and experiment for one thing over a range.
 */
@Injectable()
export class GetDeviceThroughputUseCase {
  constructor(
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    thingName: string,
    from: string,
    to: string,
    bucket: MonitoringBucket,
  ): Promise<Result<DeviceThroughputBucket[]>> {
    const result = await this.databricksPort.getDeviceThroughput(thingName, from, to, bucket);
    if (result.isFailure()) {
      return failure(result.error);
    }

    return success(
      result.value.flatMap((row) =>
        row.bucketStart === null
          ? []
          : [{ bucketStart: row.bucketStart, experimentId: row.experimentId, count: row.count }],
      ),
    );
  }
}
