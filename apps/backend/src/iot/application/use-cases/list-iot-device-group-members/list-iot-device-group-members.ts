import { Injectable } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupMemberDto } from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class ListIotDeviceGroupMembersUseCase {
  constructor(private readonly groupRepository: IotDeviceGroupRepository) {}

  async execute(groupId: string): Promise<Result<IotDeviceGroupMemberDto[]>> {
    return this.groupRepository.listMembers(groupId);
  }
}
