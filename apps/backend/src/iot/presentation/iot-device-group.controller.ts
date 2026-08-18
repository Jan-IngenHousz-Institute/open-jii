import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { deviceGroupContract } from "@repo/api/domains/device-group/device-group.contract";

import { AuthorizationService } from "../../authorization/authorization.service";
import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { resolveResourceCapabilities } from "../../authorization/resource-capabilities";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AddIotDeviceGroupMembersUseCase } from "../application/use-cases/add-iot-device-group-members/add-iot-device-group-members";
import { CreateIotDeviceGroupUseCase } from "../application/use-cases/create-iot-device-group/create-iot-device-group";
import { DeleteIotDeviceGroupUseCase } from "../application/use-cases/delete-iot-device-group/delete-iot-device-group";
import { GetIotDeviceGroupUseCase } from "../application/use-cases/get-iot-device-group/get-iot-device-group";
import { ListIotDeviceGroupMembersUseCase } from "../application/use-cases/list-iot-device-group-members/list-iot-device-group-members";
import { ListIotDeviceGroupsUseCase } from "../application/use-cases/list-iot-device-groups/list-iot-device-groups";
import { RemoveIotDeviceGroupMemberUseCase } from "../application/use-cases/remove-iot-device-group-member/remove-iot-device-group-member";
import { UpdateIotDeviceGroupUseCase } from "../application/use-cases/update-iot-device-group/update-iot-device-group";

@Controller()
export class IotDeviceGroupController {
  private readonly logger = new Logger(IotDeviceGroupController.name);

  constructor(
    private readonly createIotDeviceGroupUseCase: CreateIotDeviceGroupUseCase,
    private readonly listIotDeviceGroupsUseCase: ListIotDeviceGroupsUseCase,
    private readonly getIotDeviceGroupUseCase: GetIotDeviceGroupUseCase,
    private readonly updateIotDeviceGroupUseCase: UpdateIotDeviceGroupUseCase,
    private readonly deleteIotDeviceGroupUseCase: DeleteIotDeviceGroupUseCase,
    private readonly listIotDeviceGroupMembersUseCase: ListIotDeviceGroupMembersUseCase,
    private readonly addIotDeviceGroupMembersUseCase: AddIotDeviceGroupMembersUseCase,
    private readonly removeIotDeviceGroupMemberUseCase: RemoveIotDeviceGroupMemberUseCase,
    private readonly authz: AuthorizationService,
  ) {}

  @Implement(deviceGroupContract.listDeviceGroups)
  listDeviceGroups(@Session() session: UserSession) {
    return implement(deviceGroupContract.listDeviceGroups).handler(async () => {
      const result = await this.listIotDeviceGroupsUseCase.execute(session.user.id);

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
      const result = await this.createIotDeviceGroupUseCase.execute(input, session.user.id);

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

      return throwOrpcFailure(result, this.logger, "getDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "update", param: "groupId" })
  @Implement(deviceGroupContract.updateDeviceGroup)
  updateDeviceGroup(@Session() session: UserSession) {
    return implement(deviceGroupContract.updateDeviceGroup).handler(async ({ input }) => {
      const { groupId, ...body } = input;
      const result = await this.updateIotDeviceGroupUseCase.execute(groupId, body, session.user.id);

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
      const result = await this.deleteIotDeviceGroupUseCase.execute(input.groupId, session.user.id);

      if (result.isSuccess()) {
        return;
      }

      return throwOrpcFailure(result, this.logger, "deleteDeviceGroup");
    });
  }

  @CanAccess({ resource: "device_group", action: "read", param: "groupId" })
  @Implement(deviceGroupContract.listDeviceGroupMembers)
  listDeviceGroupMembers() {
    return implement(deviceGroupContract.listDeviceGroupMembers).handler(async ({ input }) => {
      const result = await this.listIotDeviceGroupMembersUseCase.execute(input.groupId);

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
      const result = await this.addIotDeviceGroupMembersUseCase.execute(
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
      const result = await this.removeIotDeviceGroupMemberUseCase.execute(
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
