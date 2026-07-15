import { Global, Module } from "@nestjs/common";

import { AuthorizationService } from "./authorization.service";

/**
 * Provides the single authorization entry point (org-scoped, per-resource).
 * Global so any feature module can inject AuthorizationService without re-importing.
 */
@Global()
@Module({
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
