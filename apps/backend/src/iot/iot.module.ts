import { Module } from "@nestjs/common";

import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { DeleteIotDeviceUseCase } from "./application/use-cases/delete-iot-device/delete-iot-device";
import { GetIotCredentialsUseCase } from "./application/use-cases/get-iot-credentials/get-iot-credentials";
import { GetIotDeviceUseCase } from "./application/use-cases/get-iot-device/get-iot-device";
import { GetIotUploadUrlUseCase } from "./application/use-cases/get-upload-url/get-upload-url";
import { IssueIotCredentialsUseCase } from "./application/use-cases/issue-iot-credentials/issue-iot-credentials";
import { ListIotDevicesUseCase } from "./application/use-cases/list-iot-devices/list-iot-devices";
import { RegisterIotDeviceUseCase } from "./application/use-cases/register-iot-device/register-iot-device";
import { RevokeIotCredentialsUseCase } from "./application/use-cases/revoke-iot-credentials/revoke-iot-credentials";
import { RotateIotCredentialsUseCase } from "./application/use-cases/rotate-iot-credentials/rotate-iot-credentials";
import { AWS_PORT } from "./core/ports/aws.port";
import { IotDeviceRepository } from "./core/repositories/iot-device.repository";
import { IotDeviceController } from "./presentation/iot-device.controller";
import { IotController } from "./presentation/iot.controller";

@Module({
  imports: [AwsModule, ExperimentModule],
  controllers: [IotController, IotDeviceController],
  providers: [
    GetIotCredentialsUseCase,
    GetIotUploadUrlUseCase,
    RegisterIotDeviceUseCase,
    ListIotDevicesUseCase,
    GetIotDeviceUseCase,
    DeleteIotDeviceUseCase,
    IssueIotCredentialsUseCase,
    RevokeIotCredentialsUseCase,
    RotateIotCredentialsUseCase,
    IotDeviceRepository,
    {
      provide: AWS_PORT,
      useExisting: AwsAdapter,
    },
  ],
})
export class IotModule {}
