import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module";
import { DatabaseModule } from "../common/database/database.module";
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { ANALYTICS_PORT } from "../iot/core/ports/analytics.port";
import { AddDeviceGroupMembersUseCase } from "./application/use-cases/add-device-group-members";
import { CreateDeviceGroupUseCase } from "./application/use-cases/create-device-group";
import { DeleteDeviceGroupUseCase } from "./application/use-cases/delete-device-group";
import { GetDeviceGroupUseCase } from "./application/use-cases/get-device-group";
import { ListDeviceGroupMembersUseCase } from "./application/use-cases/list-device-group-members";
import { ListDeviceGroupsUseCase } from "./application/use-cases/list-device-groups";
import { RemoveDeviceGroupMemberUseCase } from "./application/use-cases/remove-device-group-member";
import { UpdateDeviceGroupUseCase } from "./application/use-cases/update-device-group";
import { DeviceGroupRepository } from "./core/repositories/device-group.repository";
import { DeviceGroupController } from "./presentation/device-group.controller";

@Module({
  imports: [DatabaseModule, AuthorizationModule, AnalyticsModule],
  controllers: [DeviceGroupController],
  providers: [
    DeviceGroupRepository,
    CreateDeviceGroupUseCase,
    ListDeviceGroupsUseCase,
    GetDeviceGroupUseCase,
    UpdateDeviceGroupUseCase,
    DeleteDeviceGroupUseCase,
    ListDeviceGroupMembersUseCase,
    AddDeviceGroupMembersUseCase,
    RemoveDeviceGroupMemberUseCase,
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },
  ],
})
export class DeviceGroupModule {}
