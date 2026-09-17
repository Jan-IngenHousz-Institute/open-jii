import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

/**
 * Returns a retired device to the registry. Retiring cut its broker access, so
 * an instrument comes back as registered and needs a new certificate; a phone,
 * which never held one, is active again and re-binds its identity on its next
 * app open.
 */
@Injectable()
export class ReinstateIotDeviceUseCase {
  private readonly logger = new Logger(ReinstateIotDeviceUseCase.name);

  constructor(private readonly deviceRepository: IotDeviceRepository) {}

  async execute(deviceId: string, userId: string): Promise<Result<IotDeviceDto>> {
    this.logger.log({
      msg: "Reinstating device",
      operation: "reinstateIotDevice",
      deviceId,
      userId,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    const device = deviceResult.value;
    if (!device) {
      return failure(
        AppError.notFound(
          `IotDevice with ID ${deviceId} not found`,
          ErrorCodes.IOT_DEVICE_NOT_FOUND,
        ),
      );
    }

    if (device.status !== "retired") {
      return failure(
        AppError.badRequest(
          `Only a retired device can be reinstated (current status: ${device.status})`,
          ErrorCodes.IOT_CREDENTIALS_INVALID_STATE,
        ),
      );
    }

    // Phones never hold a certificate, so nothing is missing once reinstated.
    const status = device.deviceType === "mobile" ? "active" : "registered";
    const updateResult = await this.deviceRepository.update(deviceId, { status });
    if (updateResult.isFailure() || !updateResult.value) {
      return updateResult.isFailure()
        ? failure(updateResult.error)
        : failure(
            AppError.internal(
              "Failed to persist reinstated device",
              ErrorCodes.IOT_DEVICE_REINSTATE_FAILED,
            ),
          );
    }

    return success(updateResult.value);
  }
}
