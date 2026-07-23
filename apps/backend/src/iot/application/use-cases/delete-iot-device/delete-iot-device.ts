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

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    const device = deviceResult.value;
    if (!device) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    // A Thing cannot be deleted while a certificate is still attached, so revoke
    // and detach the cert first. Revoke is required (a live cert must not survive
    // a deleted device); detach is required for DeleteThing to succeed.
    if (device.certificateId && device.certificateArn) {
      const revokeResult = await this.awsPort.setCertificateStatus(device.certificateId, "REVOKED");
      if (revokeResult.isFailure()) {
        return failure(revokeResult.error);
      }

      const detachResult = await this.awsPort.detachThingPrincipal(
        device.thingName,
        device.certificateArn,
      );
      if (detachResult.isFailure()) {
        return failure(detachResult.error);
      }
    }

    const deleteThingResult = await this.awsPort.deleteThing(device.thingName);
    if (deleteThingResult.isFailure()) {
      return failure(deleteThingResult.error);
    }

    const deleteResult = await this.deviceRepository.delete(deviceId);
    if (deleteResult.isFailure()) {
      return failure(deleteResult.error);
    }

    return success(undefined);
  }
}
