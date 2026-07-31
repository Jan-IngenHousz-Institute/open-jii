import { Logger, Module } from "@nestjs/common";
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

const orpcLogger = new Logger("ORPC");

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
      // ORPCErrors are serialized straight to the response by oRPC (the rethrow
      // plugin below only forwards non-oRPC errors to Nest), so without this
      // interceptor 5xx errors raised inside the oRPC pipeline — most notably
      // output-validation failures — would never reach the logs.
      interceptors: [
        async (options): Promise<unknown> => {
          try {
            return await options.next();
          } catch (error) {
            if (error instanceof ORPCError && error.status >= 500) {
              // nestjs-pino attaches the request (method + url) to this line already.
              const cause: unknown = error.cause;
              let issues: unknown;
              if (typeof cause === "object" && cause !== null && "issues" in cause) {
                issues = (cause as Record<string, unknown>).issues;
              }
              orpcLogger.error({
                msg: error.message,
                code: String(error.code),
                ...(issues !== undefined ? { issues } : {}),
              });
            }
            throw error;
          }
        },
      ],
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
