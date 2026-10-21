import { Global, Module } from "@nestjs/common";

import { GuestDemoAdapter } from "../common/modules/analytics/guest-demo.adapter";
import { ORGANIZATION_ACCESS_PORT } from "../organizations/core/ports/organization-access.port";
import { OrganizationRepository } from "../organizations/core/repositories/organization.repository";
import { OrganizationRepositoryModule } from "../organizations/organization-repository.module";
import { GuestRepositoryModule } from "../users/guest-repository.module";
import { AuthorizeGuestUseCase } from "./application/use-cases/authorize-guest/authorize-guest";
import { AuthorizationService } from "./authorization.service";
import { CanAccessGuard } from "./can-access.guard";
import { CanCreateInOrgGuard } from "./can-create-in-org.guard";
import { DEMO_MODE_PORT } from "./core/ports/demo-mode.port";
import { EmailVisibilityService } from "./email-visibility.service";
import { GuestResourceModule } from "./guest-resource.module";
import { GuestGuard } from "./guest.guard";

/**
 * Provides the single authorization entry point (org-scoped, per-resource) and
 * the route guards (`@CanAccess`, `@CanCreateInOrg`). Global so any feature module
 * can inject AuthorizationService / apply the guards without re-importing.
 */
@Global()
@Module({
  imports: [OrganizationRepositoryModule, GuestRepositoryModule, GuestResourceModule],
  providers: [
    { provide: ORGANIZATION_ACCESS_PORT, useExisting: OrganizationRepository },
    GuestDemoAdapter,
    { provide: DEMO_MODE_PORT, useExisting: GuestDemoAdapter },
    AuthorizeGuestUseCase,
    GuestGuard,
    AuthorizationService,
    CanAccessGuard,
    CanCreateInOrgGuard,
    EmailVisibilityService,
  ],
  exports: [
    ORGANIZATION_ACCESS_PORT,
    DEMO_MODE_PORT,
    AuthorizeGuestUseCase,
    GuestGuard,
    AuthorizationService,
    CanAccessGuard,
    CanCreateInOrgGuard,
    EmailVisibilityService,
  ],
})
export class AuthorizationModule {}
