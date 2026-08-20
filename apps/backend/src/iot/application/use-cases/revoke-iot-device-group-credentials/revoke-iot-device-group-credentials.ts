import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import {
  IotDeviceGroupRevokeDto,
  IotDeviceGroupRevokeRowDto,
} from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { RevokeIotCredentialsUseCase } from "../revoke-iot-credentials/revoke-iot-credentials";

/** Mirrors the contract's cap on an explicit `deviceIds` selection. */
const MAX_BATCH = 100;

/**
 * The batch is the single-device executor run per member, continuing on
 * per-device failures so one ineligible device (no certificate, not
 * manageable by the caller) never voids the rest. Selection outside the
 * roster reports as a row error rather than silently vanishing.
 */
@Injectable()
export class RevokeIotDeviceGroupCredentialsUseCase {
  private readonly logger = new Logger(RevokeIotDeviceGroupCredentialsUseCase.name);

  constructor(
    private readonly groupRepository: IotDeviceGroupRepository,
    private readonly revokeCredentials: RevokeIotCredentialsUseCase,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async execute(
    groupId: string,
    deviceIds: string[] | undefined,
    userId: string,
  ): Promise<Result<IotDeviceGroupRevokeDto>> {
    this.logger.log({
      msg: "Revoking device group credentials",
      operation: "revokeIotDeviceGroupCredentials",
      groupId,
      userId,
      selectionCount: deviceIds?.length ?? null,
    });

    const membersResult = await this.groupRepository.listMembers(groupId);
    if (membersResult.isFailure()) {
      return membersResult;
    }

    const memberIds = new Set(membersResult.value.map((member) => member.deviceId));
    // Deduplicated: a repeated id must not run the executor twice.
    const selection = deviceIds ? [...new Set(deviceIds)] : [...memberIds];

    // Same ceiling the contract puts on an explicit selection: revocation must
    // never silently process part of the group, so an oversized batch asks for
    // an explicit subset instead.
    if (selection.length > MAX_BATCH) {
      return failure(
        AppError.badRequest(
          `The group has more than ${String(MAX_BATCH)} members; revoke an explicit selection instead`,
        ),
      );
    }

    const devices: IotDeviceGroupRevokeRowDto[] = [];
    for (const deviceId of selection) {
      devices.push(await this.revokeOne(deviceId, memberIds, userId));
    }

    return success({ devices });
  }

  private async revokeOne(
    deviceId: string,
    memberIds: Set<string>,
    userId: string,
  ): Promise<IotDeviceGroupRevokeRowDto> {
    if (!memberIds.has(deviceId)) {
      return { deviceId, error: "Not a member of this group" };
    }

    const decision = await this.authorizationService.can(userId, {
      resourceType: "device",
      resourceId: deviceId,
      action: "manage",
    });
    if (!decision.allow) {
      return { deviceId, error: "Only devices you manage can have their certificate revoked" };
    }

    const result = await this.revokeCredentials.execute(deviceId, userId);
    return result.isSuccess()
      ? { deviceId, error: null }
      : { deviceId, error: result.error.message };
  }
}
