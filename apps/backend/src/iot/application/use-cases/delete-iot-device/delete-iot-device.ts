import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class DeleteIotDeviceUseCase {
  private readonly logger = new Logger(DeleteIotDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting device",
      operation: "deleteIotDevice",
      deviceId,
      userId,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    const device = deviceResult.value;
    if (!device) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    // A live cert must not survive a deleted device.
    if (device.certificateId) {
      const revokeResult = await this.awsPort.setCertificateStatus(device.certificateId, "REVOKED");
      if (revokeResult.isFailure()) {
        return failure(revokeResult.error);
      }
    }

    // DeleteThing fails while ANY principal is attached: certificates on X.509
    // devices, Cognito identities on mobile devices. Detach whatever is there.
    const principalsResult = await this.awsPort.listThingPrincipals(device.thingName);
    if (principalsResult.isFailure()) {
      return failure(principalsResult.error);
    }
    for (const principal of principalsResult.value) {
      const detachResult = await this.awsPort.detachThingPrincipal(device.thingName, principal);
      if (detachResult.isFailure()) {
        return failure(detachResult.error);
      }
    }

    const deleteThingResult = await this.awsPort.deleteThing(device.thingName);
    if (deleteThingResult.isFailure()) {
      return failure(deleteThingResult.error);
    }

    const members = await this.sharingRepository.listMemberIds("device", deviceId);
    const name = await this.sharingRepository.findResourceName("device", deviceId);

    const deleteResult = await this.deviceRepository.delete(deviceId);
    if (deleteResult.isFailure()) {
      return failure(deleteResult.error);
    }

    if (deleteResult.value.length > 0) {
      await this.notify(userId, deviceId, name, members);
    }

    return success(undefined);
  }

  /** Tell everyone who had access. A failure here leaves the delete standing. */
  private async notify(
    actorId: string,
    deviceId: string,
    name: Result<string | null>,
    members: Result<string[]>,
  ): Promise<void> {
    if (name.isFailure() || name.value === null) {
      this.logger.error({
        msg: "Could not name the device, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteIotDevice",
        deviceId,
        ...(name.isFailure() ? { error: name.error } : {}),
      });
      return;
    }
    if (members.isFailure()) {
      this.logger.error({
        msg: "Could not read who had access, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteIotDevice",
        deviceId,
        error: members.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_deleted",
      recipientIds: members.value,
      actorId,
      resource: { type: "device", id: deviceId },
      params: { resourceName: name.value },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify members, the device was still deleted",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteIotDevice",
        deviceId,
        error: dispatched.error,
      });
    }
  }
}
