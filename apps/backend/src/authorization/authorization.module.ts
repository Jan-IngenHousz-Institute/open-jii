import { Global, Module } from "@nestjs/common";

import { OrganizationRepositoryModule } from "../organizations/organization-repository.module";
import { AuthorizationService } from "./authorization.service";
import { CanAccessGuard } from "./can-access.guard";
import { CanCreateInOrgGuard } from "./can-create-in-org.guard";
import { EmailVisibilityService } from "./email-visibility.service";

/**
 * Provides the single authorization entry point (org-scoped, per-resource) and
 * the route guards (`@CanAccess`, `@CanCreateInOrg`). Global so any feature module
 * can inject AuthorizationService / apply the guards without re-importing.
 */
@Global()
@Module({
  imports: [OrganizationRepositoryModule],
  providers: [AuthorizationService, CanAccessGuard, CanCreateInOrgGuard, EmailVisibilityService],
  exports: [
    OrganizationRepositoryModule,
    AuthorizationService,
    CanAccessGuard,
    CanCreateInOrgGuard,
    EmailVisibilityService,
  ],
})
export class AuthorizationModule {}
