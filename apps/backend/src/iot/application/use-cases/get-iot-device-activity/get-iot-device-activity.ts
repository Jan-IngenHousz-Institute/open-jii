import { Injectable, Logger } from "@nestjs/common";

import type { IotDeviceActivity } from "@repo/api/domains/iot/iot.schema";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { DeviceDataSource } from "../../../core/models/device-data.model";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { DeviceDataSourceService } from "../../services/device-data-source.service";
import { ReadableDeviceExperimentsService } from "../../services/readable-device-experiments.service";

@Injectable()
export class GetIotDeviceActivityUseCase {
  private readonly logger = new Logger(GetIotDeviceActivityUseCase.name);

  constructor(
    private readonly dataSource: DeviceDataSourceService,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly readableExperiments: ReadableDeviceExperimentsService,
  ) {}

  async execute(
    deviceId: string,
    userId: string,
    source: DeviceDataSource,
  ): Promise<Result<IotDeviceActivity>> {
    this.logger.log({
      msg: "Getting device activity",
      operation: "getIotDeviceActivity",
      deviceId,
      userId,
      source,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    // Enrichment, never a gate: a failure is reported as unavailable so
    // "never sent data" and "the source down" stay distinguishable.
    const activityResult = await this.lastActivity(deviceResult.value.thingName, userId, source);
    if (activityResult.isFailure()) {
      this.logger.warn({
        msg: "Device last-activity lookup failed; rendering as unknown",
        operation: "getIotDeviceActivity",
        deviceId,
        errorCode: activityResult.error.code,
      });
      return success({ lastDataAt: null, pipelineUnavailable: true });
    }

    return success({ ...activityResult.value, pipelineUnavailable: false });
  }

  /** The device's last data in the experiments the caller can read, over all of its rows. */
  private async lastActivity(
    thingName: string,
    userId: string,
    source: DeviceDataSource,
  ): Promise<Result<{ lastDataAt: string | null }>> {
    const experimentsResult = await this.readableExperiments.list(thingName, userId, source);
    if (experimentsResult.isFailure()) {
      return failure(experimentsResult.error);
    }

    return this.dataSource
      .readsFor(source)
      .getDeviceLastActivity(thingName, experimentsResult.value);
  }
}
