import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AwsAdapter } from "./aws.adapter";
import { AwsConfigService } from "./services/config/config.service";
import { AwsLocationService } from "./services/location/location.service";
import { AwsSecretsManagerService } from "./services/secrets-manager/secrets-manager.service";

@Module({
  imports: [ConfigModule],
  providers: [AwsConfigService, AwsLocationService, AwsSecretsManagerService, AwsAdapter],
  exports: [AwsAdapter, AwsSecretsManagerService],
})
export class AwsModule {}
