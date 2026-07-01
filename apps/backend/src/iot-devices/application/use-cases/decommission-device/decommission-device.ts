import { Inject, Injectable, Logger } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import { AWS_IOT_PORT } from "../../../core/ports/aws-iot.port";
import type { AwsIotPort } from "../../../core/ports/aws-iot.port";
import { DEVICE_REPOSITORY } from "../../../core/repositories/device.repository";
import type { DeviceRecord, DeviceRepository } from "../../../core/repositories/device.repository";

@Injectable()
export class DecommissionDeviceUseCase {
  private readonly logger = new Logger(DecommissionDeviceUseCase.name);

  constructor(
    @Inject(AWS_IOT_PORT) private readonly awsIot: AwsIotPort,
    @Inject(DEVICE_REPOSITORY) private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(thingName: string): Promise<Result<DeviceRecord>> {
    this.logger.log({ msg: "Decommissioning device", thingName });

    const device = await this.deviceRepository.findByThingName(thingName);
    if (!device) return failure(AppError.notFound(`Device ${thingName} not found`));
    if (device.status === "revoked")
      return failure(AppError.badRequest("Device is already decommissioned"));

    const revokeResult = await this.awsIot.updateCertificateStatus(device.certificateId, "REVOKED");
    if (revokeResult.isFailure()) return revokeResult;

    // Detach best-effort — cert is already revoked so the device can no longer connect.
    // Log failures but do not abort: an inconsistent detach is recoverable; a revoked
    // cert that still appears "active" in the DB is not.
    const detachResult = await this.awsIot.detachThingPrincipal(thingName, device.certificateArn);
    if (detachResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to detach principal after revoke — proceeding to update DB",
        thingName,
        error: detachResult.error,
      });
    }

    const updated = await this.deviceRepository.updateStatus(thingName, "revoked");
    this.logger.log({ msg: "Device decommissioned", thingName });
    return success(updated);
  }
}
