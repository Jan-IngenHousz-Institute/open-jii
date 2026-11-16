import { Injectable, Logger } from "@nestjs/common";

import type { ObservedExperiment } from "@repo/api/domains/iot/iot.schema";
import { foldObservedExperiments } from "@repo/api/transforms/observed-experiments";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { DeviceDataSource } from "../../../core/models/device-data.model";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { DeviceDataSourceService } from "../../services/device-data-source.service";

/**
 * The experiments a device's stored rows claim: one day-bucketed throughput
 * scan through the shared fold the lineage builder also reads arrivals with.
 * This is observation, not authorization: phones never bind, so it is the
 * only experiment record they have, and for bound devices it can differ from
 * the bindings. Recency is day-resolution by construction.
 */
@Injectable()
export class GetDeviceObservedExperimentsUseCase {
  private readonly logger = new Logger(GetDeviceObservedExperimentsUseCase.name);

  constructor(
    private readonly deviceRepository: IotDeviceRepository,
    private readonly dataSource: DeviceDataSourceService,
  ) {}

  async execute(
    deviceId: string,
    from: string,
    to: string,
    source: DeviceDataSource,
  ): Promise<Result<ObservedExperiment[]>> {
    this.logger.log({
      msg: "Getting observed experiments",
      operation: "listDeviceObservedExperiments",
      deviceId,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    const throughputResult = await this.dataSource
      .reads(source)
      .getDeviceThroughput(deviceResult.value.thingName, from, to, "day");
    if (throughputResult.isFailure()) {
      return failure(throughputResult.error);
    }

    return success(foldObservedExperiments(throughputResult.value));
  }
}
