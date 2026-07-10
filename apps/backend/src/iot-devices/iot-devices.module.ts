import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DatabaseModule } from "../common/database/database.module";
import { AwsModule } from "../common/modules/aws/aws.module";
import { DecommissionDeviceUseCase } from "./application/use-cases/decommission-device/decommission-device";
import { GetDeviceUseCase } from "./application/use-cases/get-device/get-device";
import { ListDevicesUseCase } from "./application/use-cases/list-devices/list-devices";
import { ProvisionDeviceUseCase } from "./application/use-cases/provision-device/provision-device";
import { RotateCertificateUseCase } from "./application/use-cases/rotate-certificate/rotate-certificate";
import { AWS_IOT_PORT } from "./core/ports/aws-iot.port";
import { DEVICE_REPOSITORY } from "./core/repositories/device.repository";
import { AwsIotCoreService } from "./infrastructure/aws/iot-core.service";
import { DrizzleDeviceRepository } from "./infrastructure/repositories/device.drizzle.repository";
import { IotDevicesController } from "./presentation/iot-devices.controller";

@Module({
  imports: [ConfigModule, AwsModule, DatabaseModule],
  controllers: [IotDevicesController],
  providers: [
    ProvisionDeviceUseCase,
    GetDeviceUseCase,
    ListDevicesUseCase,
    RotateCertificateUseCase,
    DecommissionDeviceUseCase,
    { provide: DEVICE_REPOSITORY, useClass: DrizzleDeviceRepository },
    { provide: AWS_IOT_PORT, useClass: AwsIotCoreService },
  ],
})
export class IotDevicesModule {}
