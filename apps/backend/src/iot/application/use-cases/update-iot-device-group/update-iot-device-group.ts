import { Injectable, Logger } from "@nestjs/common";

import type { UpdateIotDeviceGroupBody } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupDto } from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class UpdateIotDeviceGroupUseCase {
  private readonly logger = new Logger(UpdateIotDeviceGroupUseCase.name);

  constructor(private readonly groupRepository: IotDeviceGroupRepository) {}

  async execute(
    groupId: string,
    body: UpdateIotDeviceGroupBody,
    userId: string,
  ): Promise<Result<IotDeviceGroupDto>> {
    this.logger.log({
      msg: "Updating device group",
      operation: "updateIotDeviceGroup",
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
