import { Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import type { DeletionBlocker } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

/**
 * Lists the resources where the user is the only admin (the blockers for account
 * deletion), each enriched with that resource's other collaborators as transfer
 * candidates. The delete-account dialog uses this to let the user hand admin off —
 * per resource — before deleting.
 *
 * All four shareable types can block, because all four are created with a creator
 * admin grant. A macro nobody else administers blocks deletion exactly as an
 * experiment does.
 */
@Injectable()
export class GetDeletionBlockersUseCase {
  private readonly logger = new Logger(GetDeletionBlockersUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<Result<DeletionBlocker[]>> {
    this.logger.log({
      msg: "Getting account-deletion blockers",
      operation: "getDeletionBlockers",
      userId,
    });

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
    });

    return success(result);
  }
}
