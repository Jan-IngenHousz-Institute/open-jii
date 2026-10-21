import { Module } from "@nestjs/common";

import { GuestExperimentAccessModule } from "../experiments/guest-access.module";
import { GuestMacroAccessModule } from "../macros/guest-access.module";
import { GuestOrganizationAccessModule } from "../organizations/guest-access.module";
import { GuestProtocolAccessModule } from "../protocols/guest-access.module";
import { GuestWorkbookAccessModule } from "../workbooks/guest-access.module";
import { GUEST_RESOURCE_PORT } from "./core/ports/guest-resource.port";
import { GuestResourceRepository } from "./core/repositories/guest-resource.repository";

@Module({
  imports: [
    GuestExperimentAccessModule,
    GuestMacroAccessModule,
    GuestOrganizationAccessModule,
    GuestProtocolAccessModule,
    GuestWorkbookAccessModule,
  ],
  providers: [
    GuestResourceRepository,
    { provide: GUEST_RESOURCE_PORT, useExisting: GuestResourceRepository },
  ],
  exports: [GUEST_RESOURCE_PORT],
})
export class GuestResourceModule {}
