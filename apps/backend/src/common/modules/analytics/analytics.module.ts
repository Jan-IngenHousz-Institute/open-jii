import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import analyticsConfig from "../../config/analytics.config";
import { AnalyticsAdapter } from "./analytics.adapter";
import { AnalyticsConfigService } from "./services/config/config.service";
import { ErrorReporterService } from "./services/errors/error-reporter.service";
import { OrpcErrorInterceptor } from "./services/errors/orpc-error.interceptor";
import { FlagsService } from "./services/flags/flags.service";

@Module({
  imports: [ConfigModule.forFeature(analyticsConfig)],
  providers: [
    AnalyticsConfigService,
    FlagsService,
    ErrorReporterService,
    OrpcErrorInterceptor,
    AnalyticsAdapter,
  ],
  exports: [AnalyticsAdapter, ErrorReporterService, OrpcErrorInterceptor],
})
export class AnalyticsModule {}
