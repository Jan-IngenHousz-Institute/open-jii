import { Global, Module } from "@nestjs/common";

import { AuthorizationService } from "./authorization.service";
import { CanAccessGuard } from "./can-access.guard";
import { CanCreateInOrgGuard } from "./can-create-in-org.guard";
import { EmailVisibilityService } from "./email-visibility.service";
import { RequiresPlatformRoleGuard } from "./requires-platform-role.guard";

/**
 * Provides the single authorization entry point (org-scoped, per-resource) and
 * the route guards (`@CanAccess`, `@CanCreateInOrg`, `@RequiresPlatformRole`).
 * Global so any feature module can inject AuthorizationService / apply the
 * guards without re-importing.
 */
@Global()
@Module({
  providers: [
    AuthorizationService,
    CanAccessGuard,
    CanCreateInOrgGuard,
    RequiresPlatformRoleGuard,
    EmailVisibilityService,
  ],
  exports: [
    AuthorizationService,
    CanAccessGuard,
    CanCreateInOrgGuard,
    RequiresPlatformRoleGuard,
    EmailVisibilityService,
  ],
})
export class AuthorizationModule {}
