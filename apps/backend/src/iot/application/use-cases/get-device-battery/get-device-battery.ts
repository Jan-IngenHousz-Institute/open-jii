import { Injectable } from "@nestjs/common";

import type { DeviceBatteryPoint, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import type { DeviceDataSource } from "../../../core/models/device-data.model";
import { DeviceDataSourceService } from "../../services/device-data-source.service";

/**
 * Average reported battery per time bucket for one thing over a range.
 */
@Injectable()
export class GetDeviceBatteryUseCase {
  constructor(private readonly dataSource: DeviceDataSourceService) {}

  async execute(
    thingName: string,
    from: string,
    to: string,
    bucket: MonitoringBucket,
    source: DeviceDataSource,
  ): Promise<Result<DeviceBatteryPoint[]>> {
    const result = await this.dataSource
      .readsFor(source)
      .getDeviceBatterySeries(thingName, from, to, bucket);
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
