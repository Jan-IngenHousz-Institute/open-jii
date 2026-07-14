import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort, CertificateResult } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class IssueIotCredentialsUseCase {
  private readonly logger = new Logger(IssueIotCredentialsUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<CertificateResult>> {
    this.logger.log({
      msg: "Issuing device credentials",
      operation: "issueIotCredentials",
      deviceId,
      userId,
    });

    const deviceResult = await this.deviceRepository.findByIdForOwner(deviceId, userId);
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

    // Allowed from pending (never provisioned) or revoked (re-provision the same
    // device). Blocked while a live certificate exists: rotate or revoke first.
    if (device.status === "active" || device.status === "rotating") {
      return failure(
        AppError.badRequest(
          `Device already has a certificate (status: ${device.status}). Rotate or revoke it first.`,
          ErrorCodes.IOT_CREDENTIALS_INVALID_STATE,
        ),
      );
    }

    const certResult = await this.awsPort.createDeviceCertificate();
    if (certResult.isFailure()) {
      return failure(certResult.error);
    }
    const cert = certResult.value;

    const attachResult = await this.awsPort.attachThingPrincipal(
      device.thingName,
      cert.certificateArn,
    );
    if (attachResult.isFailure()) {
      await this.revokeCertificate(cert.certificateId);
      return failure(attachResult.error);
    }

    const policyResult = await this.awsPort.attachDevicePolicies(cert.certificateArn);
    if (policyResult.isFailure()) {
      await this.detachAndRevoke(device.thingName, cert);
      return failure(policyResult.error);
    }

    const updateResult = await this.deviceRepository.update(deviceId, userId, {
      certificateId: cert.certificateId,
      certificateArn: cert.certificateArn,
      status: "active",
    });
    if (updateResult.isFailure() || !updateResult.value) {
      await this.detachAndRevoke(device.thingName, cert);
      return updateResult.isFailure()
        ? failure(updateResult.error)
        : failure(
            AppError.internal(
              "Failed to persist issued credentials",
              ErrorCodes.IOT_CREDENTIALS_ISSUE_FAILED,
            ),
          );
    }

    return success(cert);
  }

  // Revoke a certificate that never became live. Best-effort: the caller is
  // already returning a failure, so log and move on.
  private async revokeCertificate(certificateId: string): Promise<void> {
    const revoke = await this.awsPort.setCertificateStatus(certificateId, "REVOKED");
    if (revoke.isFailure()) {
      this.logger.warn({ msg: "Cleanup failed: revoke cert", certificateId });
    }
  }

  private async detachAndRevoke(thingName: string, cert: CertificateResult): Promise<void> {
    const detach = await this.awsPort.detachThingPrincipal(thingName, cert.certificateArn);
    if (detach.isFailure()) {
      this.logger.warn({ msg: "Cleanup failed: detach principal", thingName });
    }
    await this.revokeCertificate(cert.certificateId);
  }
}
