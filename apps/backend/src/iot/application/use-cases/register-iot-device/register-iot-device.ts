import { Inject, Injectable, Logger } from "@nestjs/common";

import type { RegisterIotDeviceBody } from "@repo/api/domains/iot/iot.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class RegisterIotDeviceUseCase {
  private readonly logger = new Logger(RegisterIotDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
  ) {}

  async execute(
    body: RegisterIotDeviceBody,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<IotDeviceDto>> {
    this.logger.log({
      msg: "Registering device",
      operation: "registerIotDevice",
      userId,
      serialNumber: body.serialNumber,
    });

    const existing = await this.deviceRepository.findBySerialNumber(body.serialNumber);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    if (existing.value) {
      return failure(
        AppError.conflict(
          `A device with serial number ${body.serialNumber} is already registered`,
          ErrorCodes.IOT_DEVICE_ALREADY_EXISTS,
        ),
      );
    }

    const thingName = this.buildThingName(body.deviceType, body.serialNumber);
    const thingResult = await this.awsPort.createThing({
      thingName,
      attributes: {
        deviceType: body.deviceType,
        serialNumber: body.serialNumber,
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
          deviceType: body.deviceType,
        },
        userId,
        targetOrganizationId,
      );
      await this.outboxRepository.owe(tx, [
        { recordType: "device", recordId: device.id, experimentId: null },
      ]);
      return device;
    });

    if (createResult.isFailure()) {
      // Roll back the Thing so AWS does not keep an orphan when the row cannot be persisted.
      await this.awsPort.deleteThing(thing.thingName);
      return failure(createResult.error);
    }

    this.outboxWorker.nudge();
    return success(createResult.value);
  }

  // AWS IoT thing names allow [a-zA-Z0-9:_-]; sanitise so MAC-style serials are safe.
  private buildThingName(deviceType: string, serialNumber: string): string {
    const safeType = deviceType.replace(/[^a-zA-Z0-9:_-]/g, "-");
    const safeSerial = serialNumber.replace(/[^a-zA-Z0-9:_-]/g, "-");
    return `${safeType}_${safeSerial}`;
  }
}
