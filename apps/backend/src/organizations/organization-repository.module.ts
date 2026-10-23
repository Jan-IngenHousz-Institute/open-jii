import { Module } from "@nestjs/common";

import { ORGANIZATION_ACCESS_PORT } from "./core/ports/organization-access.port";
import { OrganizationRepository } from "./core/repositories/organization.repository";

@Module({
  providers: [
    OrganizationRepository,
    { provide: ORGANIZATION_ACCESS_PORT, useExisting: OrganizationRepository },
  ],
  exports: [OrganizationRepository, ORGANIZATION_ACCESS_PORT],
})
export class OrganizationRepositoryModule {}
