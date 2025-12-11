import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { AuthModule } from "@repo/auth";

import analyticsConfig from "./common/config/analytics.config";
import awsConfig from "./common/config/aws.config";
import databaseConfig from "./common/config/database.config";
import databricksConfig from "./common/config/databricks.config";
import emailConfig from "./common/config/email.config";
import { DatabaseModule } from "./common/database/database.module";
import { AnalyticsModule } from "./common/modules/analytics/analytics.module";
import { ExperimentModule } from "./experiments/experiment.module";
import { HealthModule } from "./health/health.module";
import { MacroModule } from "./macros/macro.module";
import { ProtocolModule } from "./protocols/protocol.module";
import { UserModule } from "./users/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, databricksConfig, awsConfig, emailConfig, analyticsConfig],
    }),
    ScheduleModule.forRoot(),
    AnalyticsModule,
    DatabaseModule,
    ExperimentModule,
    MacroModule,
    ProtocolModule,
    UserModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
