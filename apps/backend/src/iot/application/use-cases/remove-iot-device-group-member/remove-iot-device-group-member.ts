import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class RemoveIotDeviceGroupMemberUseCase {
  private readonly logger = new Logger(RemoveIotDeviceGroupMemberUseCase.name);

  constructor(private readonly groupRepository: IotDeviceGroupRepository) {}

  async execute(groupId: string, deviceId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Removing device group member",
      operation: "removeDeviceGroupMember",
      groupId,
      deviceId,
      userId,
    });

    // Removal needs no device-side permission: taking a device out of a group
    // grants nothing and revokes nothing on the device itself.
    return this.groupRepository.removeMember(groupId, deviceId);
  }
}
