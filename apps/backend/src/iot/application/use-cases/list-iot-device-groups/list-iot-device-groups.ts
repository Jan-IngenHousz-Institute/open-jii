import { Injectable } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupWithCountDto } from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class ListIotDeviceGroupsUseCase {
  constructor(private readonly groupRepository: IotDeviceGroupRepository) {}

  async execute(userId: string): Promise<Result<IotDeviceGroupWithCountDto[]>> {
    return this.groupRepository.listAccessible(userId);
  }
}
