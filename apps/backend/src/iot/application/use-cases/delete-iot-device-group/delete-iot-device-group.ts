import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class DeleteIotDeviceGroupUseCase {
  private readonly logger = new Logger(DeleteIotDeviceGroupUseCase.name);

  constructor(private readonly groupRepository: IotDeviceGroupRepository) {}

  async execute(groupId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting device group",
      operation: "deleteDeviceGroup",
      groupId,
      userId,
    });

    const result = await this.groupRepository.delete(groupId);
    if (result.isFailure()) {
      return failure(result.error);
    }
    if (result.value.length === 0) {
      return failure(AppError.notFound(`Device group with ID ${groupId} not found`));
    }

    return success(undefined);
  }
}
