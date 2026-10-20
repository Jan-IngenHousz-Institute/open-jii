import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ResourceDeletedNotifier } from "../../../../notifications/application/services/resource-deleted-notifier";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class DeleteIotDeviceGroupUseCase {
  private readonly logger = new Logger(DeleteIotDeviceGroupUseCase.name);

  constructor(
    private readonly groupRepository: IotDeviceGroupRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly deletionNotifier: ResourceDeletedNotifier,
  ) {}

  async execute(groupId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting device group",
      operation: "deleteIotDeviceGroup",
      groupId,
      userId,
    });

    const members = await this.sharingRepository.listMemberIds("device_group", groupId);
    const name = await this.sharingRepository.findResourceName("device_group", groupId);

    const result = await this.groupRepository.delete(groupId);
    if (result.isFailure()) {
      return failure(result.error);
    }
    if (result.value.length === 0) {
      return failure(AppError.notFound(`Device group with ID ${groupId} not found`));
    }

    await this.deletionNotifier.notify({
      operation: "deleteIotDeviceGroup",
      actorId: userId,
      resource: { type: "device_group", id: groupId },
      name: name,
      members,
    });

    return success(undefined);
  }
}
