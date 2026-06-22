import { Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { ExperimentMemberRepository } from "../../../../experiments/core/repositories/experiment-member.repository";
import type { DeletionBlocker, UserProfileMetadata } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

/**
 * Lists the experiments where the user is the only admin (the blockers for account deletion),
 * each enriched with that experiment's other members as transfer candidates. The delete-account
 * dialog uses this to let the user hand admin off — per experiment — before deleting.
 */
@Injectable()
export class GetDeletionBlockersUseCase {
  private readonly logger = new Logger(GetDeletionBlockersUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
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
      // Only active members are transfer candidates — handing admin to a deactivated ("Unknown")
      // account would re-orphan the experiment, and the transfer use case rejects them anyway.
      const membersResult = await this.experimentMemberRepository.getMembers(blocker.id, {
        activeOnly: true,
      });
      if (membersResult.isFailure()) {
        return membersResult;
      }

      // Ommit the sole admin from the candidates list
      const candidates: UserProfileMetadata[] = membersResult.value
        .filter((member) => member.user.id !== userId)
        .map((member) => ({
          userId: member.user.id,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          avatarUrl: member.user.avatarUrl,
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
