import { Module } from "@nestjs/common";

import { CognitoAdapter } from "../common/modules/aws/adapters/cognito.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { GetIoTCredentialsUseCase } from "./application/use-cases/get-iot-credentials/get-iot-credentials";
import { COGNITO_PORT } from "./core/ports/cognito.port";
import { IoTController } from "./presentation/iot.controller";

@Module({
  imports: [AwsModule],
  controllers: [IoTController],
  providers: [
    GetIoTCredentialsUseCase,
    {
      provide: COGNITO_PORT,
      useExisting: CognitoAdapter,
    },
  ],
})
export class IoTModule {}
