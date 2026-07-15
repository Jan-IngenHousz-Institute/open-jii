import { Module } from "@nestjs/common";

import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { DeleteIotDeviceUseCase } from "./application/use-cases/delete-iot-device/delete-iot-device";
import { GetDeviceRegistryUseCase } from "./application/use-cases/get-device-registry/get-device-registry";
import { GetIotCredentialsUseCase } from "./application/use-cases/get-iot-credentials/get-iot-credentials";
import { GetIotDeviceUseCase } from "./application/use-cases/get-iot-device/get-iot-device";
import { GetIotUploadUrlUseCase } from "./application/use-cases/get-upload-url/get-upload-url";
import { IssueIotCredentialsUseCase } from "./application/use-cases/issue-iot-credentials/issue-iot-credentials";
import { ListDeviceExperimentsUseCase } from "./application/use-cases/list-device-experiments/list-device-experiments";
import { ListExperimentDevicesUseCase } from "./application/use-cases/list-experiment-devices/list-experiment-devices";
import { ListIotDevicesUseCase } from "./application/use-cases/list-iot-devices/list-iot-devices";
import { OnboardDeviceUseCase } from "./application/use-cases/onboard-device/onboard-device";
import { RegisterIotDeviceUseCase } from "./application/use-cases/register-iot-device/register-iot-device";
import { RemoveExperimentDeviceUseCase } from "./application/use-cases/remove-experiment-device/remove-experiment-device";
import { RevokeIotCredentialsUseCase } from "./application/use-cases/revoke-iot-credentials/revoke-iot-credentials";
import { RotateIotCredentialsUseCase } from "./application/use-cases/rotate-iot-credentials/rotate-iot-credentials";
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { AWS_PORT } from "./core/ports/aws.port";
import { ExperimentDeviceRepository } from "./core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "./core/repositories/iot-device.repository";
import { DeviceRegistryWebhookController } from "./presentation/device-registry-webhook.controller";
import { ExperimentDeviceController } from "./presentation/experiment-device.controller";
import { IotDeviceController } from "./presentation/iot-device.controller";
import { IotController } from "./presentation/iot.controller";

@Module({
  imports: [AwsModule, AnalyticsModule, ExperimentModule],
  controllers: [
    IotController,
    IotDeviceController,
    ExperimentDeviceController,
    DeviceRegistryWebhookController,
  ],
  providers: [
    GetDeviceRegistryUseCase,
    GetIotCredentialsUseCase,
    GetIotUploadUrlUseCase,
    RegisterIotDeviceUseCase,
    ListIotDevicesUseCase,
    GetIotDeviceUseCase,
    DeleteIotDeviceUseCase,
    IssueIotCredentialsUseCase,
    RevokeIotCredentialsUseCase,
    RotateIotCredentialsUseCase,
    OnboardDeviceUseCase,
    ListDeviceExperimentsUseCase,
    ListExperimentDevicesUseCase,
    RemoveExperimentDeviceUseCase,
    IotDeviceRepository,
    ExperimentDeviceRepository,
    {
      provide: AWS_PORT,
      useExisting: AwsAdapter,
    },
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },
  ],
})
export class IotModule {}
