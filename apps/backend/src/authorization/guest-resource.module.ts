import { Module } from "@nestjs/common";

import { GuestExperimentAccessRepository } from "../experiments/core/repositories/guest-access.repository";
import { GuestMacroAccessRepository } from "../macros/core/repositories/guest-access.repository";
import { GuestOrganizationAccessRepository } from "../organizations/core/repositories/guest-access.repository";
import { GuestProtocolAccessRepository } from "../protocols/core/repositories/guest-access.repository";
import { GuestWorkbookAccessRepository } from "../workbooks/core/repositories/guest-access.repository";
import { GUEST_RESOURCE_PORT } from "./core/ports/guest-resource.port";
import { GuestResourceRepository } from "./core/repositories/guest-resource.repository";

@Module({
  providers: [
    GuestExperimentAccessRepository,
    GuestMacroAccessRepository,
    GuestProtocolAccessRepository,
    GuestWorkbookAccessRepository,
    GuestOrganizationAccessRepository,
    GuestResourceRepository,
    { provide: GUEST_RESOURCE_PORT, useExisting: GuestResourceRepository },
  ],
  exports: [GUEST_RESOURCE_PORT],
})
export class GuestResourceModule {}
