import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";
import type { IotDeviceDto } from "../../core/models/iot-device.model";
import { AWS_PORT } from "../../core/ports/aws.port";
import type { AwsPort } from "../../core/ports/aws.port";
import { IotDeviceRepository } from "../../core/repositories/iot-device.repository";

/**
 * Registering creates no AWS thing (decision 2): a device registered by connection holds
 * only the name its thing will have. Issuing credentials creates the thing on first need.
 * CreateThing with the same name, type and attributes succeeds again, so a retry after a
 * failure between creating the thing and saving its ARN reuses the thing.
 */
@Injectable()
export class DeviceThingService {
  private readonly logger = new Logger(DeviceThingService.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async ensureThing(device: IotDeviceDto): Promise<Result<IotDeviceDto>> {
    if (device.thingArn) {
      return success(device);
    }

    this.logger.log({
      msg: "Creating the AWS thing on first credentials",
      operation: "ensureThing",
      deviceId: device.id,
    });
    const thingResult = await this.awsPort.createThing({
      thingName: device.thingName,
      attributes: { deviceType: device.deviceType, serialNumber: device.serialNumber },
    });
    if (thingResult.isFailure()) {
      return failure(thingResult.error);
    }

    const saved = await this.deviceRepository.transaction((tx) =>
      this.deviceRepository.update(tx, device.id, { thingArn: thingResult.value.thingArn }),
    );
    if (saved.isFailure()) {
      return failure(saved.error);
    }
    if (!saved.value) {
      return failure(
        AppError.notFound(
          `IotDevice with ID ${device.id} not found`,
          ErrorCodes.IOT_DEVICE_NOT_FOUND,
        ),
      );
    }
    return success(saved.value);
  }
}
