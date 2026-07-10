import { Inject, Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class DeleteIotDeviceUseCase {
  private readonly logger = new Logger(DeleteIotDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting device",
      operation: "deleteIotDevice",
      deviceId,
      userId,
    });

    const deviceResult = await this.deviceRepository.findByIdForOwner(deviceId, userId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    const deleteThingResult = await this.awsPort.deleteThing(deviceResult.value.thingName);
    if (deleteThingResult.isFailure()) {
      return failure(deleteThingResult.error);
    }

    const deleteResult = await this.deviceRepository.delete(deviceId, userId);
    if (deleteResult.isFailure()) {
      return failure(deleteResult.error);
    }

    return success(undefined);
  }
}
