import { Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import type { DeletionBlocker, DeletionBlockers } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

/**
 * Everything standing between this user and account deletion. Resources come with
 * their other collaborators as transfer candidates, so the dialog can hand admin off
 * per resource; organizations cannot be cleared from the dialog at all.
 */
@Injectable()
export class GetDeletionBlockersUseCase {
  private readonly logger = new Logger(GetDeletionBlockersUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<Result<DeletionBlockers>> {
    this.logger.log({
      msg: "Getting account-deletion blockers",
      operation: "getDeletionBlockers",
      userId,
    });

    const organizationsResult = await this.userRepository.findSoleOwnedOrganizations(userId);
    if (organizationsResult.isFailure()) {
      return organizationsResult;
    }

    const blockersResult = await this.userRepository.findSoleAdminResources(userId);
    if (blockersResult.isFailure()) {
      return blockersResult;
    }

    const blockers = blockersResult.value;
    const result: DeletionBlocker[] = [];

    for (const blocker of blockers) {
      // Real identities on purpose, whatever an experiment's `anonymizeContributors`
      // says: this list is shown only to the resource's sole admin, who has to
      // recognise the person they are handing it to, and who already sees them on the
      // sharing surface. The sole admin themselves is left out.
      const candidatesResult = await this.userRepository.findGranteeProfiles(
        blocker.resourceType,
        blocker.id,
        userId,
      );
      if (candidatesResult.isFailure()) {
        return candidatesResult;
      }

      result.push({ ...blocker, candidates: candidatesResult.value });
    }

    this.logger.debug({
      msg: "Resolved account-deletion blockers",
      operation: "getDeletionBlockers",
      userId,
      blockerCount: result.length,
      organizationCount: organizationsResult.value.length,
    });

    return success({ resources: result, organizations: organizationsResult.value });
  }
}
