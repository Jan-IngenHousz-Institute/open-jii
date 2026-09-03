import { Injectable, Logger } from "@nestjs/common";

import type { BulkRegisterIotDevicesBody } from "@repo/api/domains/iot/iot.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AddIotDeviceGroupMembersUseCase } from "../add-iot-device-group-members/add-iot-device-group-members";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { RegisterIotDeviceUseCase } from "../register-iot-device/register-iot-device";

export interface BulkRegisteredIotDeviceDto {
  serialNumber: string;
  device: IotDeviceDto | null;
  error: string | null;
}

export interface BulkRegisterIotDevicesDto {
  devices: BulkRegisteredIotDeviceDto[];
  groupId: string | null;
  groupError: string | null;
}

/**
 * Registers a batch serial by serial, continuing on per-device failures so one
 * duplicate never voids the rest, then optionally groups whatever succeeded.
 * Group trouble is reported next to the results, never as a batch failure:
 * the devices exist by then.
 */
@Injectable()
export class BulkRegisterIotDevicesUseCase {
  private readonly logger = new Logger(BulkRegisterIotDevicesUseCase.name);

  constructor(
    private readonly registerIotDevice: RegisterIotDeviceUseCase,
    private readonly createIotDeviceGroup: CreateIotDeviceGroupUseCase,
    private readonly addIotDeviceGroupMembers: AddIotDeviceGroupMembersUseCase,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async execute(
    body: BulkRegisterIotDevicesBody,
    userId: string,
  ): Promise<Result<BulkRegisterIotDevicesDto>> {
    this.logger.log({
      msg: "Bulk registering devices",
      operation: "bulkRegisterIotDevices",
      userId,
      count: body.devices.length,
      grouped: body.group !== undefined,
    });

    const devices: BulkRegisteredIotDeviceDto[] = [];
    for (const device of body.devices) {
      const result = await this.registerIotDevice.execute(
        {
          serialNumber: device.serialNumber,
          name: device.name,
          deviceType: body.deviceType,
        },
        userId,
        body.organizationId ?? null,
      );

      devices.push(
        result.isSuccess()
          ? { serialNumber: device.serialNumber, device: result.value, error: null }
          : { serialNumber: device.serialNumber, device: null, error: result.error.message },
      );
    }

    const registeredIds = devices
      .map((row) => row.device?.id)
      .filter((id): id is string => id !== undefined);

    if (body.group === undefined) {
      return success({ devices, groupId: null, groupError: null });
    }
    if (registeredIds.length === 0) {
      return success({
        devices,
        groupId: null,
        groupError: "No devices were registered, so no group was touched",
      });
    }

    const groupResult = await this.resolveGroup(body.group, body.organizationId ?? null, userId);
    if (groupResult.isFailure()) {
      return success({ devices, groupId: null, groupError: groupResult.error.message });
    }

    const groupId = groupResult.value;
    const added = await this.addIotDeviceGroupMembers.execute(groupId, registeredIds, userId);
    if (added.isFailure()) {
      return success({ devices, groupId: null, groupError: added.error.message });
    }

    return success({ devices, groupId, groupError: null });
  }

  private async resolveGroup(
    group: NonNullable<BulkRegisterIotDevicesBody["group"]>,
    organizationId: string | null,
    userId: string,
  ): Promise<Result<string>> {
    if ("groupId" in group) {
      const decision = await this.authorizationService.can(userId, {
        resourceType: "device_group",
        resourceId: group.groupId,
        action: "contribute",
      });
      if (!decision.allow) {
        return failure(
          decision.reason === "not-found"
            ? AppError.notFound("Device group not found")
            : AppError.forbidden("You cannot add devices to this group"),
        );
      }
      return success(group.groupId);
    }

    const created = await this.createIotDeviceGroup.execute(
      { name: group.name, organizationId: organizationId ?? undefined },
      userId,
    );
    if (created.isFailure()) {
      return failure(created.error);
    }
    return success(created.value.id);
  }
}
