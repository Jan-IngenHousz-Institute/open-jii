import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { MyOrganizationDto } from "../../../core/models/organization.model";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * The caller's memberships, personal workspace included and flagged. An endpoint
 * rather than session state: the session cookie is cached for a day, so an embedded
 * membership map would go stale on every role change.
 */
@Injectable()
export class ListMyOrganizationsUseCase {
  private readonly logger = new Logger(ListMyOrganizationsUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(userId: string): Promise<Result<MyOrganizationDto[]>> {
    this.logger.log({
      msg: "Listing the caller's organizations",
      operation: "list-my-organizations",
      userId,
    });

    return this.organizationRepository.listMyOrganizations(userId);
  }
}
