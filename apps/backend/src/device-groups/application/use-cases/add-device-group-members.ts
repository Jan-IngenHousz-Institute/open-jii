import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../authorization/authorization.service";
import { AppError, Result, failure } from "../../../common/utils/fp-utils";
import { DeviceGroupMemberDto } from "../../core/models/device-group.model";
import { DeviceGroupRepository } from "../../core/repositories/device-group.repository";

/**
 * Grouping is operational custody, so every device added must be one the
 * caller can manage; the whole batch is rejected when any is not, keeping the
 * result predictable for a multi-select.
 */
@Injectable()
export class AddDeviceGroupMembersUseCase {
  private readonly logger = new Logger(AddDeviceGroupMembersUseCase.name);

  constructor(
    private readonly groupRepository: DeviceGroupRepository,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async execute(
    groupId: string,
    deviceIds: string[],
    userId: string,
  ): Promise<Result<DeviceGroupMemberDto[]>> {
    this.logger.log({
      msg: "Adding device group members",
      operation: "addDeviceGroupMembers",
      groupId,
      userId,
      count: deviceIds.length,
    });

    const existing = await this.groupRepository.existingDeviceIds(deviceIds);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    if (existing.value.length !== deviceIds.length) {
      return failure(AppError.notFound("One or more devices do not exist"));
    }

    for (const deviceId of deviceIds) {
      const decision = await this.authorizationService.can(userId, {
        resourceType: "device",
        resourceId: deviceId,
        action: "manage",
      });
      if (!decision.allow) {
        return failure(AppError.forbidden("Only devices you manage can be added to a group"));
      }
    }

    const added = await this.groupRepository.addMembers(groupId, deviceIds, userId);
    if (added.isFailure()) {
      return failure(added.error);
    }

    return this.groupRepository.listMembers(groupId);
  }
}
