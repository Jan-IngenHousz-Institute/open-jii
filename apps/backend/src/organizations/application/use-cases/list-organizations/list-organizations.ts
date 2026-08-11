import { Injectable, Logger } from "@nestjs/common";

import type { OrganizationDirectory } from "@repo/api/domains/organization/organization.schema";

import { Result } from "../../../../common/utils/fp-utils";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * The organization directory. Public, non-personal organizations only — the
 * exclusions live in the query rather than in a caller check, so there is no
 * listing path on which a private or personal organization can appear.
 */
@Injectable()
export class ListOrganizationsUseCase {
  private readonly logger = new Logger(ListOrganizationsUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(
    userId: string,
    params: { search?: string; limit: number; offset: number },
  ): Promise<Result<OrganizationDirectory>> {
    this.logger.log({
      msg: "Listing the organization directory",
      operation: "list-organizations",
      userId,
      hasSearch: Boolean(params.search),
    });

    return this.organizationRepository.listDirectory(userId, params);
  }
}
