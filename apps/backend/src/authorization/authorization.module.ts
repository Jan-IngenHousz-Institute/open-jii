import { Global, Module } from "@nestjs/common";

import { AuthorizationService } from "./authorization.service";
import { CanAccessGuard } from "./can-access.guard";
import { CanContributeToExperimentGuard } from "./can-contribute-to-experiment.guard";
import { CanCreateInOrgGuard } from "./can-create-in-org.guard";

/**
 * Provides the single authorization entry point (org-scoped, per-resource) and
 * the route guards (`@CanAccess`, `@CanContributeToExperiment`,
 * `@CanCreateInOrg`). Global so any feature module can inject
 * AuthorizationService / apply the guards without re-importing.
 */
@Global()
@Module({
  providers: [
    AuthorizationService,
    CanAccessGuard,
    CanContributeToExperimentGuard,
    CanCreateInOrgGuard,
  ],
  exports: [
    AuthorizationService,
    CanAccessGuard,
    CanContributeToExperimentGuard,
    CanCreateInOrgGuard,
  ],
})
export class AuthorizationModule {}
