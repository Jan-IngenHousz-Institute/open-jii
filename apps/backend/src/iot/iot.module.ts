import { Module } from "@nestjs/common";

import { AwsModule } from "../common/modules/aws/aws.module";
import { IoTController } from "./presentation/iot.controller";

@Module({
  imports: [AwsModule],
  controllers: [IoTController],
})
export class IoTModule {}
