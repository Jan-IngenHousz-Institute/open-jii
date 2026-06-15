import { Inject, Injectable, Logger } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import { AppError, failure } from "../../../../common/utils/fp-utils";
import { AWS_IOT_PORT } from "../../../core/ports/aws-iot.port";
import type { AwsIotPort, CertificateResult } from "../../../core/ports/aws-iot.port";
import { DEVICE_REPOSITORY } from "../../../core/repositories/device.repository";
import type { DeviceRepository } from "../../../core/repositories/device.repository";

@Injectable()
export class RotateCertificateUseCase {
  private readonly logger = new Logger(RotateCertificateUseCase.name);

  constructor(
    @Inject(AWS_IOT_PORT) private readonly awsIot: AwsIotPort,
    @Inject(DEVICE_REPOSITORY) private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(thingName: string): Promise<Result<CertificateResult>> {
    this.logger.log({ msg: "Rotating certificate", thingName });

    const device = await this.deviceRepository.findByThingName(thingName);
    if (!device) return failure(AppError.notFound(`Device ${thingName} not found`));
    if (device.status === "revoked")
      return failure(AppError.badRequest("Cannot rotate certificate of a revoked device"));

    await this.deviceRepository.updateStatus(thingName, "rotating");

    const newCertResult = await this.awsIot.createKeysAndCertificate();
    if (newCertResult.isFailure()) {
      await this.deviceRepository.updateStatus(thingName, "active");
      return newCertResult;
    }

    const { certificateId, certificateArn } = newCertResult.value;

    const attachResult = await this.awsIot.attachThingPrincipal(thingName, certificateArn);
    if (attachResult.isFailure()) return attachResult;

    const policyName = `open_jii_${device.deviceClass}_provisioned_device_policy`;
    const policyResult = await this.awsIot.attachPolicy(policyName, certificateArn);
    if (policyResult.isFailure()) return policyResult;

    await this.awsIot.updateCertificateStatus(device.certificateId, "INACTIVE");
    await this.awsIot.detachThingPrincipal(thingName, device.certificateArn);
    await this.deviceRepository.updateCertificate(thingName, certificateId, certificateArn);
    await this.deviceRepository.updateStatus(thingName, "active");

    this.logger.log({ msg: "Certificate rotated", thingName, newCertificateId: certificateId });
    return newCertResult;
  }
}
