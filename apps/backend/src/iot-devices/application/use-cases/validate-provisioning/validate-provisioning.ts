import { Inject, Injectable, Logger } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import { failure, success } from "../../../../common/utils/fp-utils";
import { AppError } from "../../../../common/utils/fp-utils";
import { DEVICE_REPOSITORY } from "../../../core/repositories/device.repository";
import type { DeviceRepository } from "../../../core/repositories/device.repository";

export interface ValidateProvisioningResult {
  allowed: boolean;
  reason?: string;
}

@Injectable()
export class ValidateProvisioningUseCase {
  private readonly logger = new Logger(ValidateProvisioningUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(
    serialNumber: string,
    deviceClass: string,
  ): Promise<Result<ValidateProvisioningResult>> {
    this.logger.log({ msg: "Validating device provisioning", serialNumber, deviceClass });

    const existing = await this.deviceRepository.findBySerialNumber(serialNumber);
    if (existing) {
      this.logger.warn({ msg: "Device already provisioned", serialNumber });
      return success({ allowed: false, reason: "Device already provisioned" });
    }

    const thingName = `${deviceClass}-${serialNumber}`;
    try {
      await this.deviceRepository.create({
        thingName,
        serialNumber,
        deviceClass,
        certificateId: "pending",
        certificateArn: "pending",
      });
    } catch (error) {
      // Unique constraint violation — concurrent provisioning attempt
      this.logger.warn({ msg: "Duplicate provisioning rejected (race)", serialNumber, error });
      return success({ allowed: false, reason: "Device already provisioned" });
    }

    this.logger.log({ msg: "Device provisioning approved", serialNumber, thingName });
    return success({ allowed: true });
  }
}
