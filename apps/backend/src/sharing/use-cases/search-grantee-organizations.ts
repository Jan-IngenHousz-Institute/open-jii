import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../common/utils/fp-utils";
import { GranteeOrganizationRow, SharingRepository } from "../sharing.repository";

/**
 * Organization lookup for the collaborators grantee picker.
 *
 * Authorization is the scoping itself rather than a `can()` check: the query
 * only ever returns organizations the caller is a member of, so there is no
 * per-resource decision to make and nothing is enumerable that the caller
 * cannot already see. Personal workspaces are excluded in the repository.
 */
@Injectable()
export class SearchGranteeOrganizationsUseCase {
  private readonly logger = new Logger(SearchGranteeOrganizationsUseCase.name);

  constructor(private readonly repo: SharingRepository) {}

  async execute(
    userId: string,
    params: { query?: string; limit: number },
  ): Promise<Result<GranteeOrganizationRow[]>> {
    this.logger.log({
      msg: "Searching grantee organizations",
      operation: "searchGranteeOrganizations",
      userId,
      limit: params.limit,
    });

    return this.repo.searchGranteeOrganizations(userId, params);
  }
}
