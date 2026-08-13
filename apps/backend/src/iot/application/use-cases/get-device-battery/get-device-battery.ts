import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DeviceBatteryPoint, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

/**
 * Average reported battery per time bucket for one thing over a range.
 */
@Injectable()
export class GetDeviceBatteryUseCase {
  private readonly logger = new Logger(GetDeviceBatteryUseCase.name);

  constructor(
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    thingName: string,
    from: string,
    to: string,
    bucket: MonitoringBucket,
  ): Promise<Result<DeviceBatteryPoint[]>> {
    const result = await this.databricksPort.getDeviceBatterySeries(thingName, from, to, bucket);
    if (result.isFailure()) {
      return failure(result.error);
    }

    return success(
      result.value.flatMap((row) =>
        row.bucketStart === null
          ? []
          : [{ bucketStart: row.bucketStart, averageBattery: row.averageBattery }],
      ),
    );
  }
}
