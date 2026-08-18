import { Injectable } from "@nestjs/common";

import { Result } from "../../../common/utils/fp-utils";
import { DeviceGroupWithCountDto } from "../../core/models/device-group.model";
import { DeviceGroupRepository } from "../../core/repositories/device-group.repository";

@Injectable()
export class ListDeviceGroupsUseCase {
  constructor(private readonly groupRepository: DeviceGroupRepository) {}

  async execute(userId: string): Promise<Result<DeviceGroupWithCountDto[]>> {
    return this.groupRepository.listAccessible(userId);
  }
}
