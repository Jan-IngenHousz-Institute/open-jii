import { Injectable, Logger } from "@nestjs/common";

import type { OrganizationDirectory } from "@repo/api/domains/organization/organization.schema";
import type { ResourceScope } from "@repo/api/shared/listing";

import { Result } from "../../../../common/utils/fp-utils";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * The organization directory: every non-personal organization the caller may see —
 * public ones, plus the private ones they belong to.
 *
 * The scoping lives in the query rather than in a caller check, so there is no listing
 * path on which a personal organization, or a private one the caller is not a member
 * of, can appear.
 *
 * Unpaged, and deliberately so: this is the only listing of organizations there is, so
 * "all organizations" has to mean all of them. The payload is unbounded in the number
 * of organizations — an accepted trade, the same one the resources showcase makes.
 *
 * "My organizations" is `scope: "related"` on this same read, not a separate one — so
 * both slices of the listing match, rank and order identically.
 */
@Injectable()
export class ListOrganizationsUseCase {
  private readonly logger = new Logger(ListOrganizationsUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(
    userId: string,
    params: { search?: string; scope?: ResourceScope },
  ): Promise<Result<OrganizationDirectory>> {
    this.logger.log({
      msg: "Listing the organization directory",
      operation: "list-organizations",
      userId,
      hasSearch: Boolean(params.search),
      scope: params.scope ?? "all",
    });

    return this.organizationRepository.listDirectory(userId, params);
  }
}
