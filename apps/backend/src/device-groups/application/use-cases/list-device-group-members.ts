import { Injectable } from "@nestjs/common";

import { Result } from "../../../common/utils/fp-utils";
import { DeviceGroupMemberDto } from "../../core/models/device-group.model";
import { DeviceGroupRepository } from "../../core/repositories/device-group.repository";

@Injectable()
export class ListDeviceGroupMembersUseCase {
  constructor(private readonly groupRepository: DeviceGroupRepository) {}

  async execute(groupId: string): Promise<Result<DeviceGroupMemberDto[]>> {
    return this.groupRepository.listMembers(groupId);
  }
}
