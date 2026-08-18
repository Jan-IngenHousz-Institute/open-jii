import { Injectable } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupWithCountDto } from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class GetIotDeviceGroupUseCase {
  constructor(private readonly groupRepository: IotDeviceGroupRepository) {}

  async execute(groupId: string): Promise<Result<IotDeviceGroupWithCountDto>> {
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
