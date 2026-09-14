import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { iotDeviceGroupContract } from "@repo/api/domains/iot/device-group/iot-device-group.contract";

import { AuthorizationService } from "../../authorization/authorization.service";
import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { resolveResourceCapabilities } from "../../authorization/resource-capabilities";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AddIotDeviceGroupMembersUseCase } from "../application/use-cases/add-iot-device-group-members/add-iot-device-group-members";
import { CreateIotDeviceGroupUseCase } from "../application/use-cases/create-iot-device-group/create-iot-device-group";
import { DeleteIotDeviceGroupUseCase } from "../application/use-cases/delete-iot-device-group/delete-iot-device-group";
import { GetIotDeviceGroupMonitoringUseCase } from "../application/use-cases/get-iot-device-group-monitoring/get-iot-device-group-monitoring";
import { GetIotDeviceGroupUseCase } from "../application/use-cases/get-iot-device-group/get-iot-device-group";
import { IssueIotDeviceGroupCredentialsUseCase } from "../application/use-cases/issue-iot-device-group-credentials/issue-iot-device-group-credentials";
import { ListIotDeviceGroupMembersUseCase } from "../application/use-cases/list-iot-device-group-members/list-iot-device-group-members";
import { ListIotDeviceGroupsUseCase } from "../application/use-cases/list-iot-device-groups/list-iot-device-groups";
import { OnboardIotDeviceGroupUseCase } from "../application/use-cases/onboard-iot-device-group/onboard-iot-device-group";
import { RemoveIotDeviceGroupMemberUseCase } from "../application/use-cases/remove-iot-device-group-member/remove-iot-device-group-member";
import { RevokeIotDeviceGroupCredentialsUseCase } from "../application/use-cases/revoke-iot-device-group-credentials/revoke-iot-device-group-credentials";
import { RotateIotDeviceGroupCredentialsUseCase } from "../application/use-cases/rotate-iot-device-group-credentials/rotate-iot-device-group-credentials";
import { UpdateIotDeviceGroupUseCase } from "../application/use-cases/update-iot-device-group/update-iot-device-group";

// Groups ride the same feature flag as the device registry they organize.
@Controller()
export class IotDeviceGroupController {
  private readonly logger = new Logger(IotDeviceGroupController.name);

  constructor(
    private readonly createIotDeviceGroupUseCase: CreateIotDeviceGroupUseCase,
    private readonly listIotDeviceGroupsUseCase: ListIotDeviceGroupsUseCase,
    private readonly getIotDeviceGroupUseCase: GetIotDeviceGroupUseCase,
    private readonly getIotDeviceGroupMonitoringUseCase: GetIotDeviceGroupMonitoringUseCase,
    private readonly updateIotDeviceGroupUseCase: UpdateIotDeviceGroupUseCase,
    private readonly deleteIotDeviceGroupUseCase: DeleteIotDeviceGroupUseCase,
    private readonly listIotDeviceGroupMembersUseCase: ListIotDeviceGroupMembersUseCase,
    private readonly onboardIotDeviceGroupUseCase: OnboardIotDeviceGroupUseCase,
    private readonly issueIotDeviceGroupCredentialsUseCase: IssueIotDeviceGroupCredentialsUseCase,
    private readonly rotateIotDeviceGroupCredentialsUseCase: RotateIotDeviceGroupCredentialsUseCase,
    private readonly revokeIotDeviceGroupCredentialsUseCase: RevokeIotDeviceGroupCredentialsUseCase,
    private readonly addIotDeviceGroupMembersUseCase: AddIotDeviceGroupMembersUseCase,
    private readonly removeIotDeviceGroupMemberUseCase: RemoveIotDeviceGroupMemberUseCase,
    private readonly authz: AuthorizationService,
  ) {}

  @Implement(iotDeviceGroupContract.listIotDeviceGroups)
  listIotDeviceGroups(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.listIotDeviceGroups).handler(async () => {
      const result = await this.listIotDeviceGroupsUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "listIotDeviceGroups");
    });
  }

  @CanCreateInOrg()
  @Implement(iotDeviceGroupContract.createIotDeviceGroup)
  createIotDeviceGroup(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.createIotDeviceGroup).handler(async ({ input }) => {
      const result = await this.createIotDeviceGroupUseCase.execute(input, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "createIotDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "read", param: "groupId" })
  @Implement(iotDeviceGroupContract.getIotDeviceGroup)
  getIotDeviceGroup(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.getIotDeviceGroup).handler(async ({ input }) => {
      const result = await this.getIotDeviceGroupUseCase.execute(input.groupId);

      if (result.isSuccess()) {
        const capabilities = await resolveResourceCapabilities(
          this.authz,
          session.user.id,
          "device_group",
          input.groupId,
        );
        return { ...formatDates(result.value), capabilities };
      }

      return throwOrpcFailure(result, this.logger, "getIotDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "update", param: "groupId" })
  @Implement(iotDeviceGroupContract.updateIotDeviceGroup)
  updateIotDeviceGroup(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.updateIotDeviceGroup).handler(async ({ input }) => {
      const { groupId, ...body } = input;
      const result = await this.updateIotDeviceGroupUseCase.execute(groupId, body, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "updateIotDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "manage", param: "groupId" })
  @Implement(iotDeviceGroupContract.deleteIotDeviceGroup)
  deleteIotDeviceGroup(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.deleteIotDeviceGroup).handler(async ({ input }) => {
      const result = await this.deleteIotDeviceGroupUseCase.execute(input.groupId, session.user.id);

      if (result.isSuccess()) {
        return;
      }

      return throwOrpcFailure(result, this.logger, "deleteIotDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "contribute", param: "groupId" })
  @Implement(iotDeviceGroupContract.onboardIotDeviceGroup)
  onboardIotDeviceGroup(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.onboardIotDeviceGroup).handler(async ({ input }) => {
      const result = await this.onboardIotDeviceGroupUseCase.execute(
        input.groupId,
        {
          experimentIds: input.experimentIds,
          deviceIds: input.deviceIds,
          includeWorkbook: input.includeWorkbook,
        },
        session.user.id,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "onboardIotDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "manage", param: "groupId" })
  @Implement(iotDeviceGroupContract.issueIotDeviceGroupCredentials)
  issueIotDeviceGroupCredentials(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.issueIotDeviceGroupCredentials).handler(
      async ({ input }) => {
        const result = await this.issueIotDeviceGroupCredentialsUseCase.execute(
          input.groupId,
          input.deviceIds,
          session.user.id,
        );

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger, "issueIotDeviceGroupCredentials");
      },
    );
  }

  @CanAccess({ resource: "device_group", action: "manage", param: "groupId" })
  @Implement(iotDeviceGroupContract.rotateIotDeviceGroupCredentials)
  rotateIotDeviceGroupCredentials(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.rotateIotDeviceGroupCredentials).handler(
      async ({ input }) => {
        const result = await this.rotateIotDeviceGroupCredentialsUseCase.execute(
          input.groupId,
          input.deviceIds,
          session.user.id,
        );

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger, "rotateIotDeviceGroupCredentials");
      },
    );
  }

  @CanAccess({ resource: "device_group", action: "manage", param: "groupId" })
  @Implement(iotDeviceGroupContract.revokeIotDeviceGroupCredentials)
  revokeIotDeviceGroupCredentials(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.revokeIotDeviceGroupCredentials).handler(
      async ({ input }) => {
        const result = await this.revokeIotDeviceGroupCredentialsUseCase.execute(
          input.groupId,
          input.deviceIds,
          session.user.id,
        );

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger, "revokeIotDeviceGroupCredentials");
      },
    );
  }

  @CanAccess({ resource: "device_group", action: "read", param: "groupId" })
  @Implement(iotDeviceGroupContract.getIotDeviceGroupMonitoring)
  getIotDeviceGroupMonitoring() {
    return implement(iotDeviceGroupContract.getIotDeviceGroupMonitoring).handler(
      async ({ input }) => {
        const result = await this.getIotDeviceGroupMonitoringUseCase.execute(input.groupId, {
          from: input.from,
          to: input.to,
          bucket: input.bucket,
        });

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger, "getIotDeviceGroupMonitoring");
      },
    );
  }

  @CanAccess({ resource: "device_group", action: "read", param: "groupId" })
  @Implement(iotDeviceGroupContract.listIotDeviceGroupMembers)
  listIotDeviceGroupMembers() {
    return implement(iotDeviceGroupContract.listIotDeviceGroupMembers).handler(
      async ({ input }) => {
        const result = await this.listIotDeviceGroupMembersUseCase.execute(input.groupId);

        if (result.isSuccess()) {
          return formatDatesList(result.value);
        }

        return throwOrpcFailure(result, this.logger, "listIotDeviceGroupMembers");
      },
    );
  }

  @CanAccess({ resource: "device_group", action: "contribute", param: "groupId" })
  @Implement(iotDeviceGroupContract.addIotDeviceGroupMembers)
  addIotDeviceGroupMembers(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.addIotDeviceGroupMembers).handler(async ({ input }) => {
      const result = await this.addIotDeviceGroupMembersUseCase.execute(
        input.groupId,
        input.deviceIds,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "addIotDeviceGroupMembers");
    });
  }

  @CanAccess({ resource: "device_group", action: "contribute", param: "groupId" })
  @Implement(iotDeviceGroupContract.removeIotDeviceGroupMember)
  removeIotDeviceGroupMember(@Session() session: UserSession) {
    return implement(iotDeviceGroupContract.removeIotDeviceGroupMember).handler(
      async ({ input }) => {
        const result = await this.removeIotDeviceGroupMemberUseCase.execute(
          input.groupId,
          input.deviceId,
          session.user.id,
        );

        if (result.isSuccess()) {
          return;
        }

        return throwOrpcFailure(result, this.logger, "removeIotDeviceGroupMember");
      },
    );
  }
}
