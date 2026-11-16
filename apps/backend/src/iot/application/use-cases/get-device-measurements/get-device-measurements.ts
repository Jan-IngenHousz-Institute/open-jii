import { Injectable } from "@nestjs/common";

import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import type { DeviceDataSource } from "../../../core/ports/device-reads.port";
import { DeviceDataSourceService } from "../../services/device-data-source.service";

// Row-level evidence, not a data export: enough to see what is arriving.
const RECENT_MEASUREMENT_LIMIT = 50;

/**
 * The device's most recent measurements in a range, newest first.
 */
@Injectable()
export class GetDeviceMeasurementsUseCase {
  constructor(private readonly dataSource: DeviceDataSourceService) {}

  async execute(
    thingName: string,
    from: string,
    to: string,
    source: DeviceDataSource,
  ): Promise<Result<DeviceMeasurement[]>> {
    const result = await this.dataSource
      .reads(source)
      .getDeviceRecentMeasurements(thingName, from, to, RECENT_MEASUREMENT_LIMIT);
    if (result.isFailure()) {
      return failure(result.error);
    }

    // A row whose timestamp did not parse cannot be placed in the log.
    return success(
      result.value.flatMap((row) =>
        row.timestamp === null ? [] : [{ ...row, timestamp: row.timestamp }],
      ),
    );
  }
}
