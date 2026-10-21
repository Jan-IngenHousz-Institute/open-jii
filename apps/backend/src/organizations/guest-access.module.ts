import { Module } from "@nestjs/common";

import { GuestOrganizationAccessRepository } from "./core/repositories/guest-access.repository";

@Module({
  providers: [GuestOrganizationAccessRepository],
  exports: [GuestOrganizationAccessRepository],
})
export class GuestOrganizationAccessModule {}
