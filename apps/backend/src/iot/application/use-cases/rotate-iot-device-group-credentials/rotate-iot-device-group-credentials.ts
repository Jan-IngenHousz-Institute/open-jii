import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import {
  IotDeviceGroupCredentialRowDto,
  IotDeviceGroupCredentialsDto,
} from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { RotateIotCredentialsUseCase } from "../rotate-iot-credentials/rotate-iot-credentials";

/** Mirrors the contract's cap on an explicit `deviceIds` selection. */
const MAX_BATCH = 100;

/**
 * The batch is the single-device executor run per member, continuing on
 * per-device failures so one ineligible device (no live certificate, not
 * manageable by the caller) never voids the rest. Each row rotates through the
 * single-device compensators, so a failed row rolls itself back.
 */
@Injectable()
export class RotateIotDeviceGroupCredentialsUseCase {
  private readonly logger = new Logger(RotateIotDeviceGroupCredentialsUseCase.name);

  constructor(
    private readonly groupRepository: IotDeviceGroupRepository,
    private readonly rotateCredentials: RotateIotCredentialsUseCase,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async execute(
    groupId: string,
    deviceIds: string[] | undefined,
    userId: string,
  ): Promise<Result<IotDeviceGroupCredentialsDto>> {
    this.logger.log({
      msg: "Rotating device group credentials",
      operation: "rotateIotDeviceGroupCredentials",
      groupId,
      userId,
      selectionCount: deviceIds?.length ?? null,
    });

    const membersResult = await this.groupRepository.listMembers(groupId);
    if (membersResult.isFailure()) {
      return membersResult;
    }

    const thingByDeviceId = new Map(
      membersResult.value.map((member) => [member.deviceId, member.thingName]),
    );
    const selection = deviceIds ?? [...thingByDeviceId.keys()];

    // Same ceiling the contract puts on an explicit selection: each rotation is
    // a multi-step AWS operation, so an oversized default-everyone batch asks
    // for an explicit subset instead of silently processing part of the group.
    if (selection.length > MAX_BATCH) {
      return failure(
        AppError.badRequest(
          `The group has more than ${String(MAX_BATCH)} members; rotate an explicit selection instead`,
        ),
      );
    }

    const devices: IotDeviceGroupCredentialRowDto[] = [];
    for (const deviceId of selection) {
      devices.push(await this.rotateOne(deviceId, thingByDeviceId, userId));
    }

    return success({ devices });
  }

  private async rotateOne(
    deviceId: string,
    thingByDeviceId: Map<string, string>,
    userId: string,
  ): Promise<IotDeviceGroupCredentialRowDto> {
    const thingName = thingByDeviceId.get(deviceId) ?? null;
    if (thingName === null) {
      return { deviceId, thingName: null, credentials: null, error: "Not a member of this group" };
    }

    const decision = await this.authorizationService.can(userId, {
      resourceType: "device",
      resourceId: deviceId,
      action: "manage",
    });
    if (!decision.allow) {
      return {
        deviceId,
        thingName,
        credentials: null,
        error: "Only devices you manage can have their certificate rotated",
      };
    }

    const result = await this.rotateCredentials.execute(deviceId, userId);
    return result.isSuccess()
      ? { deviceId, thingName, credentials: result.value, error: null }
      : { deviceId, thingName, credentials: null, error: result.error.message };
  }
}
