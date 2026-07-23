import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class GetIotDeviceUseCase {
  private readonly logger = new Logger(GetIotDeviceUseCase.name);

  constructor(private readonly deviceRepository: IotDeviceRepository) {}

  async execute(deviceId: string, userId: string): Promise<Result<IotDeviceDto>> {
    this.logger.log({
      msg: "Getting device",
      operation: "getIotDevice",
      deviceId,
      userId,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    return success(deviceResult.value);
  }
}
