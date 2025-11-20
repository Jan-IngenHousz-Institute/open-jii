import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import analyticsConfig from "../../config/analytics.config";
import { AnalyticsAdapter } from "./analytics.adapter";
import { AnalyticsConfigService } from "./services/config/config.service";
import { FlagsService } from "./services/flags/flags.service";

@Module({
  imports: [ConfigModule.forFeature(analyticsConfig)],
  providers: [AnalyticsConfigService, FlagsService, AnalyticsAdapter],
  exports: [AnalyticsAdapter],
})
export class AnalyticsModule {}
