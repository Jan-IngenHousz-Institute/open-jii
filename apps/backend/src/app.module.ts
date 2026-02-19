import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthGuard, AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { LoggerModule } from "nestjs-pino";

import { pinoConfig } from "@repo/analytics";
import { auth } from "@repo/auth/server";

import analyticsConfig from "./common/config/analytics.config";
import awsConfig from "./common/config/aws.config";
import databaseConfig from "./common/config/database.config";
import databricksConfig from "./common/config/databricks.config";
import emailConfig from "./common/config/email.config";
import { DatabaseModule } from "./common/database/database.module";
import { AnalyticsModule } from "./common/modules/analytics/analytics.module";
import { ExperimentModule } from "./experiments/experiment.module";
import { HealthModule } from "./health/health.module";
import { IotModule } from "./iot/iot.module";
import { MacroModule } from "./macros/macro.module";
import { ProtocolModule } from "./protocols/protocol.module";
import { UserModule } from "./users/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, databricksConfig, awsConfig, emailConfig, analyticsConfig],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        ...pinoConfig,
        name: "backend",
        autoLogging: false,
      },
    }),
    ScheduleModule.forRoot(),
    BetterAuthModule.forRoot({ auth }),
    AnalyticsModule,
    DatabaseModule,
    ExperimentModule,
    IotModule,
    MacroModule,
    ProtocolModule,
    UserModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
