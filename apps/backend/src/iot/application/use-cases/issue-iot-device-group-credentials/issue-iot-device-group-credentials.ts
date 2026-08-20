import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import {
  IotDeviceGroupCredentialRowDto,
  IotDeviceGroupCredentialsDto,
} from "../../../core/models/iot-device-group.model";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { IssueIotCredentialsUseCase } from "../issue-iot-credentials/issue-iot-credentials";

/** Mirrors the contract's cap on an explicit `deviceIds` selection. */
const MAX_BATCH = 100;

/**
 * The batch is the single-device executor run per member, continuing on
 * per-device failures so one ineligible device (already active, not
 * manageable by the caller) never voids the rest. Selection outside the
 * roster reports as a row error rather than silently vanishing.
 */
@Injectable()
export class IssueIotDeviceGroupCredentialsUseCase {
  private readonly logger = new Logger(IssueIotDeviceGroupCredentialsUseCase.name);

  constructor(
    private readonly groupRepository: IotDeviceGroupRepository,
    private readonly issueCredentials: IssueIotCredentialsUseCase,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async execute(
    groupId: string,
    deviceIds: string[] | undefined,
    userId: string,
  ): Promise<Result<IotDeviceGroupCredentialsDto>> {
    this.logger.log({
      msg: "Issuing device group credentials",
      operation: "issueIotDeviceGroupCredentials",
      groupId,
      userId,
      selectionCount: deviceIds?.length ?? null,
    });

    const membersResult = await this.groupRepository.listMembers(groupId);
    if (membersResult.isFailure()) {
      return membersResult;
    }

    const thingByDeviceId = new Map(
      membersResult.value.map((member) => [member.deviceId, member.thingName]),
    );
    const selection = deviceIds ?? [...thingByDeviceId.keys()];

    // Same ceiling the contract puts on an explicit selection: each issuance is
    // a multi-step AWS operation, so an oversized default-everyone batch asks
    // for an explicit subset instead of silently processing part of the group.
    if (selection.length > MAX_BATCH) {
      return failure(
        AppError.badRequest(
          `The group has more than ${String(MAX_BATCH)} members; issue credentials for an explicit selection instead`,
        ),
      );
    }

    const devices: IotDeviceGroupCredentialRowDto[] = [];
    for (const deviceId of selection) {
      devices.push(await this.issueOne(deviceId, thingByDeviceId, userId));
    }

    return success({ devices });
  }

  private async issueOne(
    deviceId: string,
    thingByDeviceId: Map<string, string>,
    userId: string,
  ): Promise<IotDeviceGroupCredentialRowDto> {
    const thingName = thingByDeviceId.get(deviceId) ?? null;
    if (thingName === null) {
      return { deviceId, thingName: null, credentials: null, error: "Not a member of this group" };
    }

    const decision = await this.authorizationService.can(userId, {
      resourceType: "device",
      resourceId: deviceId,
      action: "manage",
    });
    if (!decision.allow) {
      return {
        deviceId,
        thingName,
        credentials: null,
        error: "Only devices you manage can be issued credentials",
      };
    }

    const result = await this.issueCredentials.execute(deviceId, userId);
    return result.isSuccess()
      ? { deviceId, thingName, credentials: result.value, error: null }
      : { deviceId, thingName, credentials: null, error: result.error.message };
  }
}
