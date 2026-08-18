import { Inject, Injectable, Logger } from "@nestjs/common";

import type { EnsureMobileDeviceBody } from "@repo/api/domains/iot/iot.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

const MOBILE_DEVICE_TYPE = "mobile";

/**
 * Idempotent per-phone self-registration. The app calls this on every login
 * with its persisted install UUID; the first call creates the Thing and the
 * registry row (active: publishing works via Cognito, there is no certificate
 * lifecycle), later calls return the existing row and re-attach the caller's
 * Cognito identity to the Thing so the binding self-heals.
 */
@Injectable()
export class EnsureMobileDeviceUseCase {
  private readonly logger = new Logger(EnsureMobileDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(body: EnsureMobileDeviceBody, userId: string): Promise<Result<IotDeviceDto>> {
    this.logger.log({
      msg: "Ensuring mobile device",
      operation: "ensureMobileDevice",
      userId,
      installId: body.installId,
    });

    const existing = await this.deviceRepository.findBySerialNumber(body.installId);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    if (existing.value) {
      return this.resolveExisting(existing.value, userId, body.name);
    }

    const thingName = this.buildThingName(body.installId);
    const thingResult = await this.awsPort.createThing({
      thingName,
      attributes: {
        deviceType: MOBILE_DEVICE_TYPE,
        serialNumber: body.installId,
      },
    });
    if (thingResult.isFailure()) {
      return failure(thingResult.error);
    }

    const thing = thingResult.value;
    const createResult = await this.deviceRepository.create(
      {
        thingName: thing.thingName,
        thingArn: thing.thingArn,
        serialNumber: body.installId,
        name: body.name ?? null,
        deviceType: MOBILE_DEVICE_TYPE,
        status: "active",
      },
      userId,
      null,
    );

    if (createResult.isFailure() || createResult.value.length === 0) {
      // A concurrent ensure may have won the serial's unique constraint. Only
      // roll the Thing back when there is genuinely no row, otherwise the
      // rollback would delete the winner's Thing.
      const raced = await this.deviceRepository.findBySerialNumber(body.installId);
      if (raced.isSuccess() && raced.value) {
        return this.resolveExisting(raced.value, userId, body.name);
      }

      await this.awsPort.deleteThing(thing.thingName);
      return createResult.isFailure()
        ? failure(createResult.error)
        : failure(
            AppError.internal("Failed to persist device", ErrorCodes.IOT_DEVICE_REGISTER_FAILED),
          );
    }

    await this.attachIdentity(thing.thingName, userId);

    return success(createResult.value[0]);
  }

  // A row owned by the caller is simply returned (with a healing re-attach); a
  // row owned by someone else is a shared or handed-over phone, and the
  // response must not leak who owns it.
  private async resolveExisting(
    device: IotDeviceDto,
    userId: string,
    name: string | undefined,
  ): Promise<Result<IotDeviceDto>> {
    if (device.createdBy !== userId) {
      return failure(
        AppError.conflict(
          "This phone is already registered",
          ErrorCodes.IOT_DEVICE_OWNED_BY_ANOTHER_USER,
        ),
      );
    }

    await this.attachIdentity(device.thingName, userId);

    // Fill a missing name only, atomically: the conditional update loses to a
    // concurrent rename, and then the fresher row is returned instead.
    if (device.name === null && name !== undefined) {
      const renamed = await this.deviceRepository.fillNameIfMissing(device.id, name);
      if (renamed.isSuccess()) {
        if (renamed.value) {
          return success(renamed.value);
        }
        const current = await this.deviceRepository.findById(device.id);
        if (current.isSuccess() && current.value) {
          return success(current.value);
        }
      } else {
        this.logger.warn({
          msg: "Could not fill the device name; returning the row as is",
          operation: "ensureMobileDevice",
          deviceId: device.id,
        });
      }
    }

    return success(device);
  }

  // Best-effort: the binding only matters for future broker-policy tightening,
  // so a failure here never fails the ensure. AttachThingPrincipal is
  // idempotent on AWS's side.
  private async attachIdentity(thingName: string, userId: string): Promise<void> {
    const identityResult = await this.awsPort.getCognitoIdentityId(userId);
    if (identityResult.isFailure()) {
      this.logger.warn({
        msg: "Could not resolve Cognito identity; Thing left unbound",
        operation: "ensureMobileDevice",
        thingName,
        errorCode: identityResult.error.code,
      });
      return;
    }

    const attachResult = await this.awsPort.attachThingPrincipal(thingName, identityResult.value);
    if (attachResult.isFailure()) {
      this.logger.warn({
        msg: "Could not attach Cognito identity to the Thing",
        operation: "ensureMobileDevice",
        thingName,
        errorCode: attachResult.error.code,
      });
    }
  }

  // Mirrors the register use case's thing naming; the install UUID is already
  // charset-safe, the sanitize keeps the invariant explicit.
  private buildThingName(installId: string): string {
    const safeSerial = installId.replace(/[^a-zA-Z0-9:_-]/g, "-");
    return `${MOBILE_DEVICE_TYPE}_${safeSerial}`;
  }
}
