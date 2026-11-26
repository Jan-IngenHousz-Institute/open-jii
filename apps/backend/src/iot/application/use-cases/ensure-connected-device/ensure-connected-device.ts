import { Injectable, Logger } from "@nestjs/common";

import type {
  EnsureConnectedDeviceBody,
  EnsureConnectedDeviceResult,
} from "@repo/api/domains/iot/iot.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { buildThingName } from "../../../core/models/thing-name";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

type Ensured = Omit<EnsureConnectedDeviceResult, "device"> & { device: IotDeviceDto | null };

/**
 * Registers the physical unit the mobile app just connected, keyed on its family and the
 * serial it reports (decision 8): the eFuse MAC of an Ambit, MiniPAR or CO2Dot, or the full
 * Bluetooth address of a MultispeQ, which the contract has already checked against the four
 * bytes the MultispeQ reports (decision 13). Registering creates no AWS thing (decision 2);
 * the record holds the thing name, and issuing credentials creates the thing. The unit lands
 * in the caller's personal organization and moves to a team through the organization
 * transfer. Repeated connections, by anyone, reuse the unit already on record.
 */
@Injectable()
export class EnsureConnectedDeviceUseCase {
  private readonly logger = new Logger(EnsureConnectedDeviceUseCase.name);

  constructor(
    private readonly deviceRepository: IotDeviceRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
  ) {}

  async execute(body: EnsureConnectedDeviceBody, userId: string): Promise<Result<Ensured>> {
    this.logger.log({
      msg: "Ensuring connected device",
      operation: "ensureConnectedDevice",
      userId,
      family: body.family,
      serialNumber: body.serialNumber,
      firmwareVersion: body.firmwareVersion,
    });

    const existing = await this.deviceRepository.findBySerialNumberNormalized(body.serialNumber);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    if (existing.value) {
      return this.resolveExisting(existing.value, body, userId);
    }

    const createResult = await this.deviceRepository.transaction(async (tx) => {
      const device = await this.deviceRepository.create(
        tx,
        {
          thingName: buildThingName(body.family, body.serialNumber),
          thingArn: null,
          serialNumber: body.serialNumber,
          name: body.name ?? null,
          deviceType: body.family,
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
      // A concurrent connection may have won the serial's unique constraint.
      const raced = await this.deviceRepository.findBySerialNumberNormalized(body.serialNumber);
      if (raced.isSuccess() && raced.value) {
        return this.resolveExisting(raced.value, body, userId);
      }
      return failure(createResult.error);
    }

    this.outboxWorker.nudge();
    return success({ outcome: "created", device: createResult.value });
  }

  private resolveExisting(
    device: IotDeviceDto,
    body: EnsureConnectedDeviceBody,
    userId: string,
  ): Result<Ensured> {
    if (device.deviceType !== body.family) {
      this.logger.warn({
        msg: "Serial already held by another device family",
        operation: "ensureConnectedDevice",
        deviceId: device.id,
        deviceType: device.deviceType,
        family: body.family,
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
