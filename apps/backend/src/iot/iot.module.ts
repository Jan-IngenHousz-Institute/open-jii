import { Module } from "@nestjs/common";

import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { GithubAdapter } from "../common/modules/github/github.adapter";
import { GithubModule } from "../common/modules/github/github.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { WorkbookModule } from "../workbooks/workbook.module";
import { AddIotDeviceGroupMembersUseCase } from "./application/use-cases/add-iot-device-group-members/add-iot-device-group-members";
import { BulkRegisterIotDevicesUseCase } from "./application/use-cases/bulk-register-iot-devices/bulk-register-iot-devices";
import { CreateIotDeviceGroupUseCase } from "./application/use-cases/create-iot-device-group/create-iot-device-group";
import { DeleteIotDeviceGroupUseCase } from "./application/use-cases/delete-iot-device-group/delete-iot-device-group";
import { DeleteIotDeviceUseCase } from "./application/use-cases/delete-iot-device/delete-iot-device";
import { EnsureMobileDeviceUseCase } from "./application/use-cases/ensure-mobile-device/ensure-mobile-device";
import { GetDeviceBatteryUseCase } from "./application/use-cases/get-device-battery/get-device-battery";
import { GetDeviceFirmwareHistoryUseCase } from "./application/use-cases/get-device-firmware-history/get-device-firmware-history";
import { GetDeviceMeasurementsUseCase } from "./application/use-cases/get-device-measurements/get-device-measurements";
import { GetDeviceMonitoringUseCase } from "./application/use-cases/get-device-monitoring/get-device-monitoring";
import { GetDeviceObservedExperimentsUseCase } from "./application/use-cases/get-device-observed-experiments/get-device-observed-experiments";
import { GetDevicePayloadStatsUseCase } from "./application/use-cases/get-device-payload-stats/get-device-payload-stats";
import { GetDeviceRegistryUseCase } from "./application/use-cases/get-device-registry/get-device-registry";
import { GetDeviceSessionsUseCase } from "./application/use-cases/get-device-sessions/get-device-sessions";
import { GetDeviceThroughputUseCase } from "./application/use-cases/get-device-throughput/get-device-throughput";
import { GetIotCredentialsUseCase } from "./application/use-cases/get-iot-credentials/get-iot-credentials";
import { GetIotDeviceActivityUseCase } from "./application/use-cases/get-iot-device-activity/get-iot-device-activity";
import { GetIotDeviceFirmwareHistoryUseCase } from "./application/use-cases/get-iot-device-firmware-history/get-iot-device-firmware-history";
import { GetIotDeviceGroupMonitoringUseCase } from "./application/use-cases/get-iot-device-group-monitoring/get-iot-device-group-monitoring";
import { GetIotDeviceGroupUseCase } from "./application/use-cases/get-iot-device-group/get-iot-device-group";
import { GetIotDeviceUseCase } from "./application/use-cases/get-iot-device/get-iot-device";
import { GetIotFleetMonitoringUseCase } from "./application/use-cases/get-iot-fleet-monitoring/get-iot-fleet-monitoring";
import { GetIotUploadUrlUseCase } from "./application/use-cases/get-upload-url/get-upload-url";
import { IssueIotCredentialsUseCase } from "./application/use-cases/issue-iot-credentials/issue-iot-credentials";
import { IssueIotDeviceGroupCredentialsUseCase } from "./application/use-cases/issue-iot-device-group-credentials/issue-iot-device-group-credentials";
import { ListDeviceExperimentsUseCase } from "./application/use-cases/list-device-experiments/list-device-experiments";
import { ListExperimentDevicesUseCase } from "./application/use-cases/list-experiment-devices/list-experiment-devices";
import { ListIotDeviceGroupMembersUseCase } from "./application/use-cases/list-iot-device-group-members/list-iot-device-group-members";
import { ListIotDeviceGroupsUseCase } from "./application/use-cases/list-iot-device-groups/list-iot-device-groups";
import { ListIotDevicesUseCase } from "./application/use-cases/list-iot-devices/list-iot-devices";
import { ListIotFirmwareReleasesUseCase } from "./application/use-cases/list-iot-firmware-releases/list-iot-firmware-releases";
import { OnboardDeviceUseCase } from "./application/use-cases/onboard-device/onboard-device";
import { OnboardIotDeviceGroupUseCase } from "./application/use-cases/onboard-iot-device-group/onboard-iot-device-group";
import { RegisterIotDeviceUseCase } from "./application/use-cases/register-iot-device/register-iot-device";
import { RemoveExperimentDeviceUseCase } from "./application/use-cases/remove-experiment-device/remove-experiment-device";
import { RemoveIotDeviceGroupMemberUseCase } from "./application/use-cases/remove-iot-device-group-member/remove-iot-device-group-member";
import { RevokeIotCredentialsUseCase } from "./application/use-cases/revoke-iot-credentials/revoke-iot-credentials";
import { RevokeIotDeviceGroupCredentialsUseCase } from "./application/use-cases/revoke-iot-device-group-credentials/revoke-iot-device-group-credentials";
import { RotateIotCredentialsUseCase } from "./application/use-cases/rotate-iot-credentials/rotate-iot-credentials";
import { RotateIotDeviceGroupCredentialsUseCase } from "./application/use-cases/rotate-iot-device-group-credentials/rotate-iot-device-group-credentials";
import { UpdateIotDeviceGroupUseCase } from "./application/use-cases/update-iot-device-group/update-iot-device-group";
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { AWS_PORT } from "./core/ports/aws.port";
import { IOT_DATABRICKS_PORT } from "./core/ports/databricks.port";
import { GITHUB_PORT } from "./core/ports/github.port";
import { ExperimentDeviceRepository } from "./core/repositories/experiment-device.repository";
import { IotDeviceGroupRepository } from "./core/repositories/iot-device-group.repository";
import { IotDeviceRepository } from "./core/repositories/iot-device.repository";
import { DeviceRegistryWebhookController } from "./presentation/device-registry-webhook.controller";
import { ExperimentDeviceController } from "./presentation/experiment-device.controller";
import { IotDeviceGroupController } from "./presentation/iot-device-group.controller";
import { IotDeviceController } from "./presentation/iot-device.controller";
import { IotFirmwareController } from "./presentation/iot-firmware.controller";
import { IotController } from "./presentation/iot.controller";

@Module({
  imports: [
    AwsModule,
    AnalyticsModule,
    DatabricksModule,
    ExperimentModule,
    WorkbookModule,
    GithubModule,
  ],
  controllers: [
    IotController,
    IotDeviceController,
    IotDeviceGroupController,
    ExperimentDeviceController,
    DeviceRegistryWebhookController,
    IotFirmwareController,
  ],
  providers: [
    GetDeviceRegistryUseCase,
    GetIotCredentialsUseCase,
    GetIotUploadUrlUseCase,
    RegisterIotDeviceUseCase,
    BulkRegisterIotDevicesUseCase,
    EnsureMobileDeviceUseCase,
    ListIotDevicesUseCase,
    GetIotDeviceUseCase,
    GetIotDeviceActivityUseCase,
    GetDeviceMonitoringUseCase,
    GetIotFleetMonitoringUseCase,
    GetDeviceMeasurementsUseCase,
    GetDeviceFirmwareHistoryUseCase,
    GetDeviceSessionsUseCase,
    GetDeviceThroughputUseCase,
    GetDeviceBatteryUseCase,
    GetDevicePayloadStatsUseCase,
    GetDeviceObservedExperimentsUseCase,
    DeleteIotDeviceUseCase,
    IssueIotCredentialsUseCase,
    RevokeIotCredentialsUseCase,
    RotateIotCredentialsUseCase,
    OnboardDeviceUseCase,
    OnboardIotDeviceGroupUseCase,
    ListIotFirmwareReleasesUseCase,
    GetIotDeviceFirmwareHistoryUseCase,
    IssueIotDeviceGroupCredentialsUseCase,
    RotateIotDeviceGroupCredentialsUseCase,
    RevokeIotDeviceGroupCredentialsUseCase,
    ListDeviceExperimentsUseCase,
    ListExperimentDevicesUseCase,
    RemoveExperimentDeviceUseCase,
    CreateIotDeviceGroupUseCase,
    ListIotDeviceGroupsUseCase,
    GetIotDeviceGroupUseCase,
    GetIotDeviceGroupMonitoringUseCase,
    UpdateIotDeviceGroupUseCase,
    DeleteIotDeviceGroupUseCase,
    ListIotDeviceGroupMembersUseCase,
    AddIotDeviceGroupMembersUseCase,
    RemoveIotDeviceGroupMemberUseCase,
    IotDeviceRepository,
    IotDeviceGroupRepository,
    ExperimentDeviceRepository,
    {
      provide: AWS_PORT,
      useExisting: AwsAdapter,
    },
    {
      provide: GITHUB_PORT,
      useExisting: GithubAdapter,
    },
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },
    {
      provide: IOT_DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
  ],
  // For the organization showcase's device and device-group rows, both scoped by the
  // shared read predicate.
  exports: [IotDeviceRepository, IotDeviceGroupRepository],
})
export class IotModule {}
