import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

/**
 * Takes a device out of service without deleting it: its broker access is cut
 * (certificate revoked, every principal detached) and the row keeps its
 * bindings and history so lineage and monitoring still explain what it did.
 */
@Injectable()
export class RetireIotDeviceUseCase {
  private readonly logger = new Logger(RetireIotDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<IotDeviceDto>> {
    this.logger.log({ msg: "Retiring device", operation: "retireIotDevice", deviceId, userId });

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

    if (device.status === "retired") {
      return failure(
        AppError.badRequest("Device is already retired", ErrorCodes.IOT_CREDENTIALS_INVALID_STATE),
      );
    }

    // Revoke first, as revoke does: a device that can still connect after we
    // called it retired is the outcome that must not fail silently.
    if (device.certificateId) {
      const revoke = await this.awsPort.setCertificateStatus(device.certificateId, "REVOKED");
      if (revoke.isFailure()) {
        return failure(revoke.error);
      }
    }

    // Every principal, not only the certificate: a phone authenticates through
    // its Cognito identity, and retiring has to cut that off just the same.
    const principalsResult = await this.awsPort.listThingPrincipals(device.thingName);
    if (principalsResult.isFailure()) {
      return failure(principalsResult.error);
    }
    for (const principal of principalsResult.value) {
      const detach = await this.awsPort.detachThingPrincipal(device.thingName, principal);
      if (detach.isFailure()) {
        return failure(detach.error);
      }
    }

    const updateResult = await this.deviceRepository.transaction(async (tx) => {
      const updated = await this.deviceRepository.update(tx, deviceId, {
        status: "retired",
        certificateId: null,
        certificateArn: null,
      });
      if (updated) {
        await this.outboxRepository.owe(tx, [
          { recordType: "device", recordId: deviceId, experimentId: null },
        ]);
      }
      return updated;
    });
    if (updateResult.isFailure() || !updateResult.value) {
      return updateResult.isFailure()
        ? failure(updateResult.error)
        : failure(
            AppError.internal(
              "Failed to persist retired device",
              ErrorCodes.IOT_DEVICE_RETIRE_FAILED,
            ),
          );
    }

    this.outboxWorker.nudge();
    return success(updateResult.value);
  }
}
