import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  EnsureMultispeqDeviceBody,
  EnsureMultispeqDeviceResult,
} from "@repo/api/domains/iot/iot.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

const MULTISPEQ = "multispeq";

type Ensured = Omit<EnsureMultispeqDeviceResult, "device"> & { device: IotDeviceDto | null };

/**
 * Registers the physical MultispeQ the mobile app just connected, keyed on its canonical
 * four-byte identity. The unit lands in the caller's personal organization, as a manual
 * registration without a target does, and moves to a team through the organization transfer.
 * Repeated connections, by anyone, reuse the unit already on record.
 */
@Injectable()
export class EnsureMultispeqDeviceUseCase {
  private readonly logger = new Logger(EnsureMultispeqDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
  ) {}

  async execute(body: EnsureMultispeqDeviceBody, userId: string): Promise<Result<Ensured>> {
    this.logger.log({
      msg: "Ensuring MultispeQ device",
      operation: "ensureMultispeqDevice",
      userId,
      serialNumber: body.serialNumber,
    });

    const existing = await this.deviceRepository.findBySerialNumber(body.serialNumber);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    if (existing.value) {
      return this.resolveExisting(existing.value, userId);
    }

    const thingName = `${MULTISPEQ}_${body.serialNumber}`;
    const thingResult = await this.awsPort.createThing({
      thingName,
      attributes: {
        deviceType: MULTISPEQ,
        serialNumber: body.serialNumber,
        registeredVia: "mobile-connection",
        identitySource: "device_info",
        ...(body.firmwareVersion ? { firmware: body.firmwareVersion } : {}),
      },
    });
    if (thingResult.isFailure()) {
      return failure(thingResult.error);
    }

    const thing = thingResult.value;
    const createResult = await this.deviceRepository.transaction(async (tx) => {
      const device = await this.deviceRepository.create(
        tx,
        {
          thingName: thing.thingName,
          thingArn: thing.thingArn,
          serialNumber: body.serialNumber,
          name: body.name ?? null,
          deviceType: MULTISPEQ,
        },
        userId,
        null,
      );
      await this.outboxRepository.owe(tx, [
        { recordType: "device", recordId: device.id, experimentId: null },
      ]);
      return device;
    });

    if (createResult.isFailure()) {
      // A concurrent connection may have won the serial's unique constraint; deleting the
      // Thing then would remove the winner's.
      const raced = await this.deviceRepository.findBySerialNumber(body.serialNumber);
      if (raced.isSuccess() && raced.value) {
        return this.resolveExisting(raced.value, userId);
      }

      await this.awsPort.deleteThing(thing.thingName);
      return failure(createResult.error);
    }

    this.outboxWorker.nudge();
    return success({ outcome: "created", device: createResult.value });
  }

  private resolveExisting(device: IotDeviceDto, userId: string): Result<Ensured> {
    if (device.deviceType !== MULTISPEQ) {
      this.logger.warn({
        msg: "MultispeQ identity already held by another device family",
        operation: "ensureMultispeqDevice",
        deviceId: device.id,
        deviceType: device.deviceType,
      });
      return failure(
        AppError.conflict(
          "This identity is already registered for another kind of device",
          ErrorCodes.IOT_DEVICE_IDENTITY_COLLISION,
        ),
      );
    }

    // Retired units stay retired: reinstating is an operator's decision.
    return success({
      outcome: "existing",
      device: device.createdBy === userId ? device : null,
    });
  }
}
