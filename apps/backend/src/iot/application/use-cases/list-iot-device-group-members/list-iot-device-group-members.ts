import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupMemberConnectivityDto } from "../../../core/models/iot-device-group.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort, ThingConnectivity } from "../../../core/ports/aws.port";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

@Injectable()
export class ListIotDeviceGroupMembersUseCase {
  private readonly logger = new Logger(ListIotDeviceGroupMembersUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly groupRepository: IotDeviceGroupRepository,
  ) {}

  async execute(groupId: string): Promise<Result<IotDeviceGroupMemberConnectivityDto[]>> {
    const membersResult = await this.groupRepository.listMembers(groupId);
    if (membersResult.isFailure()) {
      return membersResult;
    }

    const members = membersResult.value;
    const connectivity = await this.lookupConnectivity(members.map((member) => member.thingName));

    return success(
      members.map(({ thingName, ...member }) => ({
        ...member,
        connected: connectivity?.get(thingName)?.connected ?? null,
      })),
    );
  }

  // Connectivity is an enrichment, never a gate: a fleet-index failure degrades
  // every row to unknown instead of failing the roster.
  private async lookupConnectivity(
    thingNames: string[],
  ): Promise<Map<string, ThingConnectivity> | null> {
    if (thingNames.length === 0) {
      return null;
    }

    const result = await this.awsPort.searchThingsConnectivity(thingNames);
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Fleet-index connectivity lookup failed; members render as unknown",
        operation: "listIotDeviceGroupMembers",
        errorCode: result.error.code,
      });
      return null;
    }

    return result.value;
  }
}
