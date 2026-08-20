import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupMemberConnectivityDto } from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { ListIotDeviceGroupMembersUseCase } from "../list-iot-device-group-members/list-iot-device-group-members";

/**
 * Grouping is operational custody, so every device added must be one the
 * caller can manage; the whole batch is rejected when any is not, keeping the
 * result predictable for a multi-select.
 */
@Injectable()
export class AddIotDeviceGroupMembersUseCase {
  private readonly logger = new Logger(AddIotDeviceGroupMembersUseCase.name);

  constructor(
    private readonly groupRepository: IotDeviceGroupRepository,
    private readonly listMembers: ListIotDeviceGroupMembersUseCase,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async execute(
    groupId: string,
    deviceIds: string[],
    userId: string,
  ): Promise<Result<IotDeviceGroupMemberConnectivityDto[]>> {
    this.logger.log({
      msg: "Adding device group members",
      operation: "addIotDeviceGroupMembers",
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

    // The response is the refreshed roster, so it goes through the same
    // connectivity enrichment as the list endpoint.
    return this.listMembers.execute(groupId);
  }
}
