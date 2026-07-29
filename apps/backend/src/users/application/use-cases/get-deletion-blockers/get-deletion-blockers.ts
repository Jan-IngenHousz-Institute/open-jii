import { Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type { DeletionBlocker, UserProfileMetadata } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

/**
 * Lists the experiments where the user is the only admin (the blockers for account
 * deletion), each enriched with that experiment's other collaborators as transfer
 * candidates. The delete-account dialog uses this to let the user hand admin off —
 * per experiment — before deleting.
 */
@Injectable()
export class GetDeletionBlockersUseCase {
  private readonly logger = new Logger(GetDeletionBlockersUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  async execute(userId: string): Promise<Result<DeletionBlocker[]>> {
    this.logger.log({
      msg: "Getting account-deletion blockers",
      operation: "getDeletionBlockers",
      userId,
    });

    const blockersResult = await this.userRepository.findSoleAdminExperiments(userId);
    if (blockersResult.isFailure()) {
      return blockersResult;
    }

    const blockers = blockersResult.value;
    const result: DeletionBlocker[] = [];

    for (const blocker of blockers) {
      // Only the experiment's activated collaborators are candidates — handing admin
      // to a deactivated ("Unknown") account would re-orphan the experiment, and the
      // transfer use case rejects them anyway.
      const collaboratorsResult = await this.experimentRepository.listCollaborators(blocker.id);
      if (collaboratorsResult.isFailure()) {
        return collaboratorsResult;
      }

      // Real identities on purpose, whatever `anonymizeContributors` says: this list
      // is shown only to the experiment's sole admin, who has to recognise the person
      // they are handing it to, and who already sees them on the sharing surface.
      // Omit the sole admin themselves from the candidates list.
      const candidates: UserProfileMetadata[] = collaboratorsResult.value.collaborators
        .filter((collaborator) => collaborator.userId !== userId)
        .map((collaborator) => ({
          userId: collaborator.userId,
          firstName: collaborator.firstName,
          lastName: collaborator.lastName,
          avatarUrl: collaborator.avatarUrl,
        }));

      result.push({
        id: blocker.id,
        name: blocker.name,
        status: blocker.status,
        candidates,
      });
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
