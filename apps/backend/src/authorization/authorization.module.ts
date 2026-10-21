import { Global, Module } from "@nestjs/common";

import { GuestDemoAdapter } from "../common/modules/analytics/guest-demo.adapter";
import { GuestRepositoryModule } from "../users/guest-repository.module";
import { AuthorizeGuestUseCase } from "./application/use-cases/authorize-guest/authorize-guest";
import { AuthorizationService } from "./authorization.service";
import { CanAccessGuard } from "./can-access.guard";
import { CanCreateInOrgGuard } from "./can-create-in-org.guard";
import { DEMO_MODE_PORT } from "./core/ports/demo-mode.port";
import { EmailVisibilityService } from "./email-visibility.service";
import { GuestResourceModule } from "./guest-resource.module";
import { GuestGuard } from "./guest.guard";
import { RequiresPlatformRoleGuard } from "./requires-platform-role.guard";

/**
 * Provides the single authorization entry point (org-scoped, per-resource) and
 * the route guards (`@CanAccess`, `@CanCreateInOrg`, `@RequiresPlatformRole`).
 * Global so any feature module can inject AuthorizationService / apply the
 * guards without re-importing.
 */
@Global()
@Module({
  imports: [GuestRepositoryModule, GuestResourceModule],
  providers: [
    GuestDemoAdapter,
    { provide: DEMO_MODE_PORT, useExisting: GuestDemoAdapter },
    AuthorizeGuestUseCase,
    GuestGuard,
    AuthorizationService,
    CanAccessGuard,
    CanCreateInOrgGuard,
    RequiresPlatformRoleGuard,
    EmailVisibilityService,
  ],
  exports: [
    DEMO_MODE_PORT,
    AuthorizeGuestUseCase,
    GuestGuard,
    AuthorizationService,
    CanAccessGuard,
    CanCreateInOrgGuard,
    RequiresPlatformRoleGuard,
    EmailVisibilityService,
  ],
})
export class AuthorizationModule {}
