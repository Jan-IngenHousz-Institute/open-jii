import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class DeleteIotDeviceGroupUseCase {
  private readonly logger = new Logger(DeleteIotDeviceGroupUseCase.name);

  constructor(
    private readonly groupRepository: IotDeviceGroupRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly notifications: NotificationDispatchService,
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

    await this.notify(userId, groupId, name, members);

    return success(undefined);
  }

  /** Tell everyone who had access. A failure here leaves the delete standing. */
  private async notify(
    actorId: string,
    groupId: string,
    name: Result<string | null>,
    members: Result<string[]>,
  ): Promise<void> {
    if (name.isFailure() || name.value === null) {
      this.logger.error({
        msg: "Could not name the device group, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteIotDeviceGroup",
        groupId,
        ...(name.isFailure() ? { error: name.error } : {}),
      });
      return;
    }
    if (members.isFailure()) {
      this.logger.error({
        msg: "Could not read who had access, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteIotDeviceGroup",
        groupId,
        error: members.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_deleted",
      recipientIds: members.value,
      actorId,
      resource: { type: "device_group", id: groupId },
      params: { resourceName: name.value },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify members, the device group was still deleted",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteIotDeviceGroup",
        groupId,
        error: dispatched.error,
      });
    }
  }
}
