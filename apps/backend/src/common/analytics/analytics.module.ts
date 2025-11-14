import { Module } from "@nestjs/common";

import { AnalyticsService } from "./analytics.service";

/**
 * Analytics module providing feature flags and event tracking
 * Import this module to use AnalyticsService in your application
 */
@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
