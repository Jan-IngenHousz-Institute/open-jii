import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class RevokeIotCredentialsUseCase {
  private readonly logger = new Logger(RevokeIotCredentialsUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<IotDeviceDto>> {
    this.logger.log({
      msg: "Revoking device credentials",
      operation: "revokeIotCredentials",
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

    if (!device.certificateId) {
      return failure(
        AppError.badRequest(
          "Device has no active certificate to revoke",
          ErrorCodes.IOT_CREDENTIALS_INVALID_STATE,
        ),
      );
    }

    // Revoke first: once the cert is REVOKED the device can no longer connect,
    // which is the outcome that must not fail silently.
    const revokeResult = await this.awsPort.setCertificateStatus(device.certificateId, "REVOKED");
    if (revokeResult.isFailure()) {
      return failure(revokeResult.error);
    }

    // Detach is best-effort: the cert is already revoked, so a leftover principal
    // is recoverable; a DB row that still looks active is not.
    if (device.certificateArn) {
      const detach = await this.awsPort.detachThingPrincipal(
        device.thingName,
        device.certificateArn,
      );
      if (detach.isFailure()) {
        this.logger.warn({ msg: "Cleanup failed: detach principal after revoke", deviceId });
      }
    }

    const updateResult = await this.deviceRepository.update(deviceId, {
      status: "revoked",
      certificateId: null,
      certificateArn: null,
    });
    if (updateResult.isFailure() || !updateResult.value) {
      return updateResult.isFailure()
        ? failure(updateResult.error)
        : failure(
            AppError.internal(
              "Failed to persist revoked device",
              ErrorCodes.IOT_CREDENTIALS_REVOKE_FAILED,
            ),
          );
    }

    return success(updateResult.value);
  }
}
