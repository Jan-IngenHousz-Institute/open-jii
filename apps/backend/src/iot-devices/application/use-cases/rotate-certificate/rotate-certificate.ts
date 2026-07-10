import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
    private readonly configService: ConfigService,
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
    if (attachResult.isFailure()) {
      const r1 = await this.awsIot.updateCertificateStatus(certificateId, "REVOKED");
      if (r1.isFailure())
        this.logger.warn({
          msg: "Cleanup failed: revoke new cert",
          certificateId,
          error: r1.error,
        });
      await this.deviceRepository.updateStatus(thingName, "active");
      return attachResult;
    }

    const policyName = this.configService.getOrThrow<string>("IOT_DEVICE_POLICY_NAME");
    const policyResult = await this.awsIot.attachPolicy(policyName, certificateArn);
    if (policyResult.isFailure()) {
      const r1 = await this.awsIot.detachThingPrincipal(thingName, certificateArn);
      if (r1.isFailure())
        this.logger.warn({
          msg: "Cleanup failed: detach new principal",
          thingName,
          error: r1.error,
        });
      const r2 = await this.awsIot.updateCertificateStatus(certificateId, "REVOKED");
      if (r2.isFailure())
        this.logger.warn({
          msg: "Cleanup failed: revoke new cert",
          certificateId,
          error: r2.error,
        });
      await this.deviceRepository.updateStatus(thingName, "active");
      return policyResult;
    }

    // New cert is live — retire the old one. These are best-effort: the device is
    // already operational with the new cert, so log failures but do not abort.
    const deactivateOld = await this.awsIot.updateCertificateStatus(
      device.certificateId,
      "INACTIVE",
    );
    if (deactivateOld.isFailure())
      this.logger.warn({
        msg: "Failed to deactivate old cert",
        certificateId: device.certificateId,
        error: deactivateOld.error,
      });
    const detachOld = await this.awsIot.detachThingPrincipal(thingName, device.certificateArn);
    if (detachOld.isFailure())
      this.logger.warn({
        msg: "Failed to detach old principal",
        thingName,
        error: detachOld.error,
      });
    await this.deviceRepository.updateCertificate(thingName, certificateId, certificateArn);
    await this.deviceRepository.updateStatus(thingName, "active");

    this.logger.log({ msg: "Certificate rotated", thingName, newCertificateId: certificateId });
    return newCertResult;
  }
}
