import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { deviceGroupContract } from "@repo/api/domains/device-group/device-group.contract";

import { AuthorizationService } from "../../authorization/authorization.service";
import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { resolveResourceCapabilities } from "../../authorization/resource-capabilities";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ANALYTICS_PORT } from "../../iot/core/ports/analytics.port";
import type { AnalyticsPort } from "../../iot/core/ports/analytics.port";
import { AddDeviceGroupMembersUseCase } from "../application/use-cases/add-device-group-members";
import { CreateDeviceGroupUseCase } from "../application/use-cases/create-device-group";
import { DeleteDeviceGroupUseCase } from "../application/use-cases/delete-device-group";
import { GetDeviceGroupUseCase } from "../application/use-cases/get-device-group";
import { ListDeviceGroupMembersUseCase } from "../application/use-cases/list-device-group-members";
import { ListDeviceGroupsUseCase } from "../application/use-cases/list-device-groups";
import { RemoveDeviceGroupMemberUseCase } from "../application/use-cases/remove-device-group-member";
import { UpdateDeviceGroupUseCase } from "../application/use-cases/update-device-group";

// Groups ride the same feature flag as the device registry they organize.
@Controller()
export class DeviceGroupController {
  private readonly logger = new Logger(DeviceGroupController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly createDeviceGroupUseCase: CreateDeviceGroupUseCase,
    private readonly listDeviceGroupsUseCase: ListDeviceGroupsUseCase,
    private readonly getDeviceGroupUseCase: GetDeviceGroupUseCase,
    private readonly updateDeviceGroupUseCase: UpdateDeviceGroupUseCase,
    private readonly deleteDeviceGroupUseCase: DeleteDeviceGroupUseCase,
    private readonly listDeviceGroupMembersUseCase: ListDeviceGroupMembersUseCase,
    private readonly addDeviceGroupMembersUseCase: AddDeviceGroupMembersUseCase,
    private readonly removeDeviceGroupMemberUseCase: RemoveDeviceGroupMemberUseCase,
    private readonly authz: AuthorizationService,
  ) {}

  private devicesEnabled(session: UserSession): Promise<boolean> {
    return this.analyticsPort.isFeatureFlagEnabled(
      FEATURE_FLAGS.IOT_DEVICES,
      session.user.email || session.user.id,
    );
  }

  private disabled(operation: string): never {
    return throwOrpcError(
      AppError.forbidden("The device registry is currently disabled"),
      this.logger,
      operation,
    );
  }

  @Implement(deviceGroupContract.listDeviceGroups)
  listDeviceGroups(@Session() session: UserSession) {
    return implement(deviceGroupContract.listDeviceGroups).handler(async () => {
      if (!(await this.devicesEnabled(session))) this.disabled("listDeviceGroups");

      const result = await this.listDeviceGroupsUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "listDeviceGroups");
    });
  }

  @CanCreateInOrg()
  @Implement(deviceGroupContract.createDeviceGroup)
  createDeviceGroup(@Session() session: UserSession) {
    return implement(deviceGroupContract.createDeviceGroup).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("createDeviceGroup");

      const result = await this.createDeviceGroupUseCase.execute(input, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "createDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "read", param: "groupId" })
  @Implement(deviceGroupContract.getDeviceGroup)
  getDeviceGroup(@Session() session: UserSession) {
    return implement(deviceGroupContract.getDeviceGroup).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getDeviceGroup");

      const result = await this.getDeviceGroupUseCase.execute(input.groupId);

      if (result.isSuccess()) {
        const capabilities = await resolveResourceCapabilities(
          this.authz,
          session.user.id,
          "device_group",
          input.groupId,
        );
        return { ...formatDates(result.value), capabilities };
      }

      return throwOrpcFailure(result, this.logger, "getDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "update", param: "groupId" })
  @Implement(deviceGroupContract.updateDeviceGroup)
  updateDeviceGroup(@Session() session: UserSession) {
    return implement(deviceGroupContract.updateDeviceGroup).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("updateDeviceGroup");

      const { groupId, ...body } = input;
      const result = await this.updateDeviceGroupUseCase.execute(groupId, body, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "updateDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "manage", param: "groupId" })
  @Implement(deviceGroupContract.deleteDeviceGroup)
  deleteDeviceGroup(@Session() session: UserSession) {
    return implement(deviceGroupContract.deleteDeviceGroup).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("deleteDeviceGroup");

      const result = await this.deleteDeviceGroupUseCase.execute(input.groupId, session.user.id);

      if (result.isSuccess()) {
        return;
      }

      return throwOrpcFailure(result, this.logger, "deleteDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "read", param: "groupId" })
  @Implement(deviceGroupContract.listDeviceGroupMembers)
  listDeviceGroupMembers(@Session() session: UserSession) {
    return implement(deviceGroupContract.listDeviceGroupMembers).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("listDeviceGroupMembers");

      const result = await this.listDeviceGroupMembersUseCase.execute(input.groupId);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "listDeviceGroupMembers");
    });
  }

  @CanAccess({ resource: "device_group", action: "contribute", param: "groupId" })
  @Implement(deviceGroupContract.addDeviceGroupMembers)
  addDeviceGroupMembers(@Session() session: UserSession) {
    return implement(deviceGroupContract.addDeviceGroupMembers).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("addDeviceGroupMembers");

      const result = await this.addDeviceGroupMembersUseCase.execute(
        input.groupId,
        input.deviceIds,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "addDeviceGroupMembers");
    });
  }

  @CanAccess({ resource: "device_group", action: "contribute", param: "groupId" })
  @Implement(deviceGroupContract.removeDeviceGroupMember)
  removeDeviceGroupMember(@Session() session: UserSession) {
    return implement(deviceGroupContract.removeDeviceGroupMember).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("removeDeviceGroupMember");

      const result = await this.removeDeviceGroupMemberUseCase.execute(
        input.groupId,
        input.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return;
      }

      return throwOrpcFailure(result, this.logger, "removeDeviceGroupMember");
    });
  }
}
