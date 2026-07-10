import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Result } from "../../../../common/utils/fp-utils";
import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import { AWS_IOT_PORT } from "../../../core/ports/aws-iot.port";
import type { AwsIotPort } from "../../../core/ports/aws-iot.port";
import { DEVICE_REPOSITORY } from "../../../core/repositories/device.repository";
import type { DeviceRepository } from "../../../core/repositories/device.repository";

export interface ProvisionDeviceResult {
  thingName: string;
  certificateId: string;
  certificateArn: string;
  certificatePem: string;
  privateKey: string;
}

@Injectable()
export class ProvisionDeviceUseCase {
  private readonly logger = new Logger(ProvisionDeviceUseCase.name);

  constructor(
    @Inject(AWS_IOT_PORT) private readonly awsIot: AwsIotPort,
    @Inject(DEVICE_REPOSITORY) private readonly deviceRepository: DeviceRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    serialNumber: string,
    deviceClass: string,
    ownerUserId: string,
  ): Promise<Result<ProvisionDeviceResult>> {
    this.logger.log({ msg: "Provisioning device", serialNumber, deviceClass, ownerUserId });

    const existing = await this.deviceRepository.findBySerialNumber(serialNumber);
    if (existing) {
      this.logger.warn({ msg: "Device already provisioned", serialNumber });
      return failure(AppError.conflict("Device already provisioned"));
    }

    const thingName = `${deviceClass}-${serialNumber}`;
    const prefix = this.configService.getOrThrow<string>("IOT_RESOURCE_PREFIX");
    const thingTypeName = `${prefix}-${deviceClass}`;
    const thingGroupName = `${prefix}-all-devices`;

    const thingResult = await this.awsIot.createThing(
      thingName,
      deviceClass,
      serialNumber,
      thingTypeName,
    );
    if (thingResult.isFailure()) return thingResult;

    const groupResult = await this.awsIot.addThingToThingGroup(thingName, thingGroupName);
    if (groupResult.isFailure()) {
      await this.awsIot.deleteThing(thingName);
      return groupResult;
    }

    const certResult = await this.awsIot.createKeysAndCertificate();
    if (certResult.isFailure()) {
      await this.awsIot.deleteThing(thingName);
      return certResult;
    }
    const { certificateId, certificateArn, certificatePem, privateKey } = certResult.value;

    const attachResult = await this.awsIot.attachThingPrincipal(thingName, certificateArn);
    if (attachResult.isFailure()) {
      await this.awsIot.updateCertificateStatus(certificateId, "REVOKED");
      await this.awsIot.deleteThing(thingName);
      return attachResult;
    }

    const policyName = this.configService.getOrThrow<string>("IOT_DEVICE_POLICY_NAME");
    const policyResult = await this.awsIot.attachPolicy(policyName, certificateArn);
    if (policyResult.isFailure()) {
      await this.awsIot.detachThingPrincipal(thingName, certificateArn);
      await this.awsIot.updateCertificateStatus(certificateId, "REVOKED");
      await this.awsIot.deleteThing(thingName);
      return policyResult;
    }

    await this.deviceRepository.create({
      thingName,
      serialNumber,
      deviceClass,
      certificateId,
      certificateArn,
      ownerUserId,
    });

    this.logger.log({ msg: "Device provisioned", thingName, certificateId });
    return success({ thingName, certificateId, certificateArn, certificatePem, privateKey });
  }
}
