import { Injectable, Logger } from "@nestjs/common";

import type { DeviceFirmwareVersion, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { DeviceDataSource } from "../../../core/models/device-data.model";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { ReadableDeviceExperimentsService } from "../../services/readable-device-experiments.service";
import { GetDeviceFirmwareHistoryUseCase } from "../get-device-firmware-history/get-device-firmware-history";

/**
 * The device-addressed firmware history. Exists so a caller that only wants
 * reported versions pays for the firmware scan, after the one that finds the
 * experiments it may read, instead of the six the monitoring dashboard fans out.
 */
@Injectable()
export class GetIotDeviceFirmwareHistoryUseCase {
  private readonly logger = new Logger(GetIotDeviceFirmwareHistoryUseCase.name);

  constructor(
    private readonly deviceRepository: IotDeviceRepository,
    private readonly readableExperiments: ReadableDeviceExperimentsService,
    private readonly getDeviceFirmwareHistory: GetDeviceFirmwareHistoryUseCase,
  ) {}

  async execute(
    deviceId: string,
    from: string,
    to: string,
    bucket: MonitoringBucket,
    userId: string,
    source: DeviceDataSource,
  ): Promise<Result<DeviceFirmwareVersion[]>> {
    this.logger.log({
      msg: "Getting device firmware history",
      operation: "getDeviceFirmwareHistory",
      deviceId,
      bucket,
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
    const thingName = deviceResult.value.thingName;

    const experimentsResult = await this.readableExperiments.list(thingName, userId, source, {
      from,
      to,
    });
    if (experimentsResult.isFailure()) {
      return failure(experimentsResult.error);
    }

    return this.getDeviceFirmwareHistory.execute(
      thingName,
      experimentsResult.value,
      from,
      to,
      bucket,
      source,
    );
  }
}
