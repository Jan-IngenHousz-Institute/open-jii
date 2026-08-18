import { Injectable, Logger } from "@nestjs/common";

import type { CreateDeviceGroupBody } from "@repo/api/domains/device-group/device-group.schema";

import { Result, failure, success } from "../../../common/utils/fp-utils";
import { DeviceGroupDto } from "../../core/models/device-group.model";
import { DeviceGroupRepository } from "../../core/repositories/device-group.repository";

@Injectable()
export class CreateDeviceGroupUseCase {
  private readonly logger = new Logger(CreateDeviceGroupUseCase.name);

  constructor(private readonly groupRepository: DeviceGroupRepository) {}

  async execute(body: CreateDeviceGroupBody, userId: string): Promise<Result<DeviceGroupDto>> {
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
