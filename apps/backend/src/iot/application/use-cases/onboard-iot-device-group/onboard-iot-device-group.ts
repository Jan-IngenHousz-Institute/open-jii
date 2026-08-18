import { Injectable, Logger } from "@nestjs/common";

import type { DeviceOnboardingConfig } from "@repo/api/domains/iot/iot.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { OnboardDeviceUseCase } from "../onboard-device/onboard-device";

/** Mirrors the contract's cap on an explicit `deviceIds` selection. */
const MAX_BATCH = 100;

export interface OnboardDeviceGroupWindow {
  experimentIds: string[];
  deviceIds?: string[];
  includeWorkbook: boolean;
}

export interface IotDeviceGroupOnboardRowDto {
  deviceId: string;
  config: DeviceOnboardingConfig | null;
  error: string | null;
}

export interface IotDeviceGroupOnboardDto {
  devices: IotDeviceGroupOnboardRowDto[];
}

/**
 * The batch is the single-device executor run per member, continuing on
 * per-device failures so one ineligible device (mobile, no live credentials,
 * not manageable by the caller) never voids the rest. Selection outside the
 * roster reports as a row error rather than silently vanishing.
 */
@Injectable()
export class OnboardIotDeviceGroupUseCase {
  private readonly logger = new Logger(OnboardIotDeviceGroupUseCase.name);

  constructor(
    private readonly groupRepository: IotDeviceGroupRepository,
    private readonly onboardDevice: OnboardDeviceUseCase,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async execute(
    groupId: string,
    body: OnboardDeviceGroupWindow,
    userId: string,
  ): Promise<Result<IotDeviceGroupOnboardDto>> {
    this.logger.log({
      msg: "Onboarding device group",
      operation: "onboardDeviceGroup",
      groupId,
      userId,
      experimentCount: body.experimentIds.length,
      selectionCount: body.deviceIds?.length ?? null,
    });

    const membersResult = await this.groupRepository.listMembers(groupId);
    if (membersResult.isFailure()) {
      return membersResult;
    }

    const memberIds = new Set(membersResult.value.map((member) => member.deviceId));
    const selection = body.deviceIds ?? [...memberIds];

    // Same ceiling the contract puts on an explicit selection: each onboard is
    // a multi-query operation, so an oversized default-everyone batch asks for
    // an explicit subset instead of silently processing part of the group.
    if (selection.length > MAX_BATCH) {
      return failure(
        AppError.badRequest(
          `The group has more than ${String(MAX_BATCH)} members; onboard an explicit selection instead`,
        ),
      );
    }

    const devices: IotDeviceGroupOnboardRowDto[] = [];
    for (const deviceId of selection) {
      devices.push(await this.onboardOne(deviceId, memberIds, body, userId));
    }

    return success({ devices });
  }

  private async onboardOne(
    deviceId: string,
    memberIds: Set<string>,
    body: OnboardDeviceGroupWindow,
    userId: string,
  ): Promise<IotDeviceGroupOnboardRowDto> {
    if (!memberIds.has(deviceId)) {
      return { deviceId, config: null, error: "Not a member of this group" };
    }

    const decision = await this.authorizationService.can(userId, {
      resourceType: "device",
      resourceId: deviceId,
      action: "manage",
    });
    if (!decision.allow) {
      return { deviceId, config: null, error: "Only devices you manage can be onboarded" };
    }

    const result = await this.onboardDevice.execute(
      deviceId,
      body.experimentIds,
      userId,
      body.includeWorkbook,
    );
    return result.isSuccess()
      ? { deviceId, config: result.value, error: null }
      : { deviceId, config: null, error: result.error.message };
  }
}
