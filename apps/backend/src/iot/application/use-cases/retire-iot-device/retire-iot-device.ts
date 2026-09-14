import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

/**
 * Takes a device out of service without deleting it: the certificate is
 * revoked so it can no longer connect, and the row keeps its bindings and
 * history so lineage and monitoring still explain what it did.
 */
@Injectable()
export class RetireIotDeviceUseCase {
  private readonly logger = new Logger(RetireIotDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<IotDeviceDto>> {
    this.logger.log({ msg: "Retiring device", operation: "retireIotDevice", deviceId, userId });

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

    if (device.status === "retired") {
      return failure(
        AppError.badRequest("Device is already retired", ErrorCodes.IOT_CREDENTIALS_INVALID_STATE),
      );
    }

    // Revoke first, as revoke does: a device that can still connect after we
    // called it retired is the outcome that must not fail silently.
    if (device.certificateId) {
      const revoke = await this.awsPort.setCertificateStatus(device.certificateId, "REVOKED");
      if (revoke.isFailure()) {
        return failure(revoke.error);
      }
      if (device.certificateArn) {
        const detach = await this.awsPort.detachThingPrincipal(
          device.thingName,
          device.certificateArn,
        );
        if (detach.isFailure()) {
          this.logger.warn({ msg: "Cleanup failed: detach principal after retire", deviceId });
        }
      }
    }

    const updateResult = await this.deviceRepository.update(deviceId, {
      status: "retired",
      certificateId: null,
      certificateArn: null,
    });
    if (updateResult.isFailure() || !updateResult.value) {
      return updateResult.isFailure()
        ? failure(updateResult.error)
        : failure(
            AppError.internal(
              "Failed to persist retired device",
              ErrorCodes.IOT_DEVICE_RETIRE_FAILED,
            ),
          );
    }

    return success(updateResult.value);
  }
}
