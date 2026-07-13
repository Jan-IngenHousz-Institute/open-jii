import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AwsAdapter } from "./aws.adapter";
import { CognitoService } from "./services/cognito/cognito.service";
import { AwsConfigService } from "./services/config/config.service";
import { AwsIotService } from "./services/iot/iot.service";
import { AwsLambdaService } from "./services/lambda/lambda.service";
import { AwsLocationService } from "./services/location/location.service";
import { AwsS3Service } from "./services/s3/s3.service";

@Module({
  imports: [ConfigModule],
  providers: [
    AwsConfigService,
    AwsLocationService,
    CognitoService,
    AwsIotService,
    AwsLambdaService,
    AwsS3Service,
    AwsAdapter,
  ],
  exports: [AwsAdapter],
})
export class AwsModule {}
