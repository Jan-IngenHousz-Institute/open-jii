import { Injectable, Logger } from "@nestjs/common";

import type { DeviceOnboardingConfig } from "@repo/api/domains/iot/iot.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { OnboardDeviceUseCase } from "../onboard-device/onboard-device";

/** Mirrors the contract's cap on an explicit `deviceIds` selection. */
const MAX_BATCH = 100;

/** Rows are independent; small chunks bound DB and AWS pressure per request. */
const BATCH_CONCURRENCY = 5;

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
    // Deduplicated: a repeated id must not run the executor twice.
    const selection = body.deviceIds ? [...new Set(body.deviceIds)] : [...memberIds];

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
    for (let i = 0; i < selection.length; i += BATCH_CONCURRENCY) {
      const chunk = selection.slice(i, i + BATCH_CONCURRENCY);
      devices.push(
        ...(await Promise.all(
          chunk.map((deviceId) => this.onboardOne(deviceId, memberIds, body, userId)),
        )),
      );
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
    if (result.isSuccess()) {
      return { deviceId, config: result.value, error: null };
    }

    // 4xx guard messages speak to the user; 5xx internals must not leak into
    // the row, so they are logged and replaced with a generic failure.
    if (result.error.statusCode >= 500) {
      this.logger.error({
        msg: "Device onboarding failed",
        operation: "onboardDeviceGroup",
        deviceId,
        errorCode: result.error.code,
        error: result.error.message,
      });
      return { deviceId, config: null, error: "Onboarding failed" };
    }
    return { deviceId, config: null, error: result.error.message };
  }
}
