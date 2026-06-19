import { Module } from "@nestjs/common";

import { OrganizationsController } from "./organizations.controller";
import { OrganizationsRepository } from "./organizations.repository";
import {
  CancelOrganizationJoinRequestUseCase,
  DecideOrganizationJoinRequestUseCase,
  GetOrganizationAccessUseCase,
  GetOrganizationResourcesUseCase,
  GetOrganizationUseCase,
  ListOrganizationJoinRequestsUseCase,
  ListPublicOrganizationsUseCase,
  RequestOrganizationJoinUseCase,
} from "./organizations.use-cases";

/** Organization directory, public profiles/resources, and request-to-join. */
@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsRepository,
    ListPublicOrganizationsUseCase,
    GetOrganizationUseCase,
    GetOrganizationResourcesUseCase,
    GetOrganizationAccessUseCase,
    RequestOrganizationJoinUseCase,
    ListOrganizationJoinRequestsUseCase,
    DecideOrganizationJoinRequestUseCase,
    CancelOrganizationJoinRequestUseCase,
  ],
})
export class OrganizationsModule {}
