import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort, CertificateResult } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class RotateIotCredentialsUseCase {
  private readonly logger = new Logger(RotateIotCredentialsUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<CertificateResult>> {
    this.logger.log({
      msg: "Rotating device credentials",
      operation: "rotateIotCredentials",
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

    if (device.status !== "active" || !device.certificateId || !device.certificateArn) {
      return failure(
        AppError.badRequest(
          `Only an active device can rotate its certificate (current status: ${device.status})`,
          ErrorCodes.IOT_CREDENTIALS_INVALID_STATE,
        ),
      );
    }

    const oldCertificateId = device.certificateId;
    const oldCertificateArn = device.certificateArn;

    await this.deviceRepository.update(deviceId, { status: "rotating" });

    const certResult = await this.awsPort.createDeviceCertificate();
    if (certResult.isFailure()) {
      await this.revertToActive(deviceId);
      return failure(certResult.error);
    }
    const cert = certResult.value;

    const attachResult = await this.awsPort.attachThingPrincipal(
      device.thingName,
      cert.certificateArn,
    );
    if (attachResult.isFailure()) {
      await this.revokeCertificate(cert.certificateId);
      await this.revertToActive(deviceId);
      return failure(attachResult.error);
    }

    const policyResult = await this.awsPort.attachDevicePolicies(cert.certificateArn);
    if (policyResult.isFailure()) {
      await this.detachAndRevoke(device.thingName, cert);
      await this.revertToActive(deviceId);
      return failure(policyResult.error);
    }

    // New cert is live — retire the old one. Best-effort: the device already works
    // with the new cert, so log failures but do not abort.
    await this.retireCertificate(device.thingName, oldCertificateId, oldCertificateArn);

    const updateResult = await this.deviceRepository.update(deviceId, {
      certificateId: cert.certificateId,
      certificateArn: cert.certificateArn,
      status: "active",
    });
    if (updateResult.isFailure() || !updateResult.value) {
      return updateResult.isFailure()
        ? failure(updateResult.error)
        : failure(
            AppError.internal(
              "Failed to persist rotated credentials",
              ErrorCodes.IOT_CREDENTIALS_ROTATE_FAILED,
            ),
          );
    }

    return success(cert);
  }

  private async revertToActive(deviceId: string): Promise<void> {
    const revert = await this.deviceRepository.update(deviceId, { status: "active" });
    if (revert.isFailure()) {
      this.logger.warn({ msg: "Cleanup failed: revert status to active", deviceId });
    }
  }

  // Retire a superseded certificate: revoke it and detach its principal.
  private async retireCertificate(
    thingName: string,
    certificateId: string,
    certificateArn: string,
  ): Promise<void> {
    const revoke = await this.awsPort.setCertificateStatus(certificateId, "REVOKED");
    if (revoke.isFailure()) {
      this.logger.warn({ msg: "Failed to revoke old cert", certificateId });
    }
    const detach = await this.awsPort.detachThingPrincipal(thingName, certificateArn);
    if (detach.isFailure()) {
      this.logger.warn({ msg: "Failed to detach old principal", thingName });
    }
  }

  private async revokeCertificate(certificateId: string): Promise<void> {
    const revoke = await this.awsPort.setCertificateStatus(certificateId, "REVOKED");
    if (revoke.isFailure()) {
      this.logger.warn({ msg: "Cleanup failed: revoke new cert", certificateId });
    }
  }

  private async detachAndRevoke(thingName: string, cert: CertificateResult): Promise<void> {
    const detach = await this.awsPort.detachThingPrincipal(thingName, cert.certificateArn);
    if (detach.isFailure()) {
      this.logger.warn({ msg: "Cleanup failed: detach new principal", thingName });
    }
    await this.revokeCertificate(cert.certificateId);
  }
}
