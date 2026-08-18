import { Injectable } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";
import { DeviceGroupWithCountDto } from "../../core/models/device-group.model";
import { DeviceGroupRepository } from "../../core/repositories/device-group.repository";

@Injectable()
export class GetDeviceGroupUseCase {
  constructor(private readonly groupRepository: DeviceGroupRepository) {}

  async execute(groupId: string): Promise<Result<DeviceGroupWithCountDto>> {
    const result = await this.groupRepository.findById(groupId);
    if (result.isFailure()) {
      return failure(result.error);
    }
    if (!result.value) {
      return failure(AppError.notFound(`Device group with ID ${groupId} not found`));
    }

    return success(result.value);
  }
}
