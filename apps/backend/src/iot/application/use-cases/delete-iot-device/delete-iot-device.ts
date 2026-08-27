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

    // A live cert must not survive a deleted device.
    if (device.certificateId) {
      const revokeResult = await this.awsPort.setCertificateStatus(device.certificateId, "REVOKED");
      if (revokeResult.isFailure()) {
        return failure(revokeResult.error);
      }
    }

    // DeleteThing fails while ANY principal is attached: certificates on X.509
    // devices, Cognito identities on mobile devices. Detach whatever is there.
    const principalsResult = await this.awsPort.listThingPrincipals(device.thingName);
    if (principalsResult.isFailure()) {
      return failure(principalsResult.error);
    }
    for (const principal of principalsResult.value) {
      const detachResult = await this.awsPort.detachThingPrincipal(device.thingName, principal);
      if (detachResult.isFailure()) {
        return failure(detachResult.error);
      }
    }

    // Best-effort: a deleted device's topic must not keep serving its last
    // config to a re-registered thing of the same name.
    const clearResult = await this.awsPort.clearDeviceConfig(device.thingName);
    if (clearResult.isFailure()) {
      this.logger.warn({
        msg: "Retained config clear failed during device delete",
        operation: "deleteIotDevice",
        deviceId,
        error: clearResult.error.message,
      });
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
