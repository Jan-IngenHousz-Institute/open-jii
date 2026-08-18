import { Injectable, Logger } from "@nestjs/common";

import type { UpdateDeviceGroupBody } from "@repo/api/domains/device-group/device-group.schema";

import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";
import { DeviceGroupDto } from "../../core/models/device-group.model";
import { DeviceGroupRepository } from "../../core/repositories/device-group.repository";

@Injectable()
export class UpdateDeviceGroupUseCase {
  private readonly logger = new Logger(UpdateDeviceGroupUseCase.name);

  constructor(private readonly groupRepository: DeviceGroupRepository) {}

  async execute(
    groupId: string,
    body: UpdateDeviceGroupBody,
    userId: string,
  ): Promise<Result<DeviceGroupDto>> {
    this.logger.log({
      msg: "Updating device group",
      operation: "updateDeviceGroup",
      groupId,
      userId,
    });

    const result = await this.groupRepository.update(groupId, body);
    if (result.isFailure()) {
      return failure(result.error);
    }
    if (!result.value) {
      return failure(AppError.notFound(`Device group with ID ${groupId} not found`));
    }

    return success(result.value);
  }
}
