import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ORPCError, ORPCModule } from "@orpc/nest";
import { experimental_RethrowHandlerPlugin as RethrowHandlerPlugin } from "@orpc/server/plugins";
import { AuthGuard, AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { LoggerModule } from "nestjs-pino";

import { pinoConfig } from "@repo/analytics";
import { auth } from "@repo/auth/server";

import { AuthorizationModule } from "./authorization/authorization.module";
import analyticsConfig from "./common/config/analytics.config";
import awsConfig from "./common/config/aws.config";
import databaseConfig from "./common/config/database.config";
import databricksConfig from "./common/config/databricks.config";
import emailConfig from "./common/config/email.config";
import mailchimpConfig from "./common/config/mailchimp.config";
import { DatabaseModule } from "./common/database/database.module";
import { AnalyticsModule } from "./common/modules/analytics/analytics.module";
import { ExperimentModule } from "./experiments/experiment.module";
import { HealthModule } from "./health/health.module";
import { IotModule } from "./iot/iot.module";
import { MacroModule } from "./macros/macro.module";
import { NewsletterModule } from "./newsletter/newsletter.module";
import { ProtocolModule } from "./protocols/protocol.module";
import { SearchModule } from "./search/search.module";
import { UserModule } from "./users/user.module";
import { WorkbookModule } from "./workbooks/workbook.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        databricksConfig,
        awsConfig,
        emailConfig,
        mailchimpConfig,
        analyticsConfig,
      ],
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
    ORPCModule.forRoot({
      plugins: [new RethrowHandlerPlugin({ filter: (error) => !(error instanceof ORPCError) })],
    }),
    AnalyticsModule,
    AuthorizationModule,
    DatabaseModule,
    ExperimentModule,
    IotModule,
    MacroModule,
    NewsletterModule,
    ProtocolModule,
    SearchModule,
    UserModule,
    WorkbookModule,
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
