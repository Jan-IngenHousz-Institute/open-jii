import { Module } from "@nestjs/common";

import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { GetIotCredentialsUseCase } from "./application/use-cases/get-iot-credentials/get-iot-credentials";
import { GetIotUploadUrlUseCase } from "./application/use-cases/get-upload-url/get-upload-url";
import { AWS_PORT } from "./core/ports/aws.port";
import { IotController } from "./presentation/iot.controller";

@Module({
  imports: [AwsModule],
  controllers: [IotController],
  providers: [
    GetIotCredentialsUseCase,
    GetIotUploadUrlUseCase,
    {
      provide: AWS_PORT,
      useExisting: AwsAdapter,
    },
  ],
})
export class IotModule {}
