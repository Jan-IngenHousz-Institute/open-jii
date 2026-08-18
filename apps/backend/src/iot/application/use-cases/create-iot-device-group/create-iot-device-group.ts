import { Injectable, Logger } from "@nestjs/common";

import type { CreateDeviceGroupBody } from "@repo/api/domains/device-group/device-group.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupDto } from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class CreateIotDeviceGroupUseCase {
  private readonly logger = new Logger(CreateIotDeviceGroupUseCase.name);

  constructor(private readonly groupRepository: IotDeviceGroupRepository) {}

  async execute(body: CreateDeviceGroupBody, userId: string): Promise<Result<IotDeviceGroupDto>> {
    this.logger.log({ msg: "Creating device group", operation: "createDeviceGroup", userId });

    const result = await this.groupRepository.create(
      { name: body.name, description: body.description ?? null },
      userId,
      body.organizationId ?? null,
    );
    if (result.isFailure()) {
      return failure(result.error);
    }

    return success(result.value[0]);
  }
}
