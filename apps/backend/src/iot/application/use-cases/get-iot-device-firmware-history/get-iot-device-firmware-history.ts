import { Injectable, Logger } from "@nestjs/common";

import type { DeviceFirmwareVersion, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { GetDeviceFirmwareHistoryUseCase } from "../get-device-firmware-history/get-device-firmware-history";

/**
 * The device-addressed firmware history. Exists so a caller that only wants
 * reported versions pays for one warehouse scan instead of the six the
 * monitoring dashboard fans out.
 */
@Injectable()
export class GetIotDeviceFirmwareHistoryUseCase {
  private readonly logger = new Logger(GetIotDeviceFirmwareHistoryUseCase.name);

  constructor(
    private readonly deviceRepository: IotDeviceRepository,
    private readonly getDeviceFirmwareHistory: GetDeviceFirmwareHistoryUseCase,
  ) {}

  async execute(
    deviceId: string,
    from: string,
    to: string,
    bucket: MonitoringBucket,
  ): Promise<Result<DeviceFirmwareVersion[]>> {
    this.logger.log({
      msg: "Getting device firmware history",
      operation: "getDeviceFirmwareHistory",
      deviceId,
      bucket,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    return this.getDeviceFirmwareHistory.execute(deviceResult.value.thingName, from, to, bucket);
  }
}
