import { Global, Module } from "@nestjs/common";

import { SetVisibilityUseCase } from "./set-visibility";
import { VisibilityRepository } from "./visibility.repository";

/**
 * Provides the shared `setVisibility` capability (monotonic private→public) used by
 * the per-type publish routes and the embargo cron. Global so any feature module
 * can inject it without re-importing, mirroring `AuthorizationModule`.
 */
@Global()
@Module({
  providers: [SetVisibilityUseCase, VisibilityRepository],
  exports: [SetVisibilityUseCase],
})
export class VisibilityModule {}
