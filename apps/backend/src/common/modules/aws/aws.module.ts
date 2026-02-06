import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AwsAdapter } from "./aws.adapter";
import { CognitoService } from "./services/cognito/cognito.service";
import { AwsConfigService } from "./services/config/config.service";
import { AwsLocationService } from "./services/location/location.service";

@Module({
  imports: [ConfigModule],
  providers: [AwsConfigService, AwsLocationService, AwsAdapter, CognitoService],
  exports: [AwsAdapter, CognitoService],
})
export class AwsModule {}
