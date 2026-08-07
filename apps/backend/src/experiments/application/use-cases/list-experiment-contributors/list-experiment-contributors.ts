import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentContributor } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";

import { Result } from "../../../../common/utils/fp-utils";
import type { ExperimentCollaborators } from "../../../core/repositories/experiment.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ContributorAnonymizerService } from "../../services/contributor-anonymizer.service";

@Injectable()
export class ListExperimentContributorsUseCase {
  private readonly logger = new Logger(ListExperimentContributorsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly contributorAnonymizer: ContributorAnonymizerService,
  ) {}

  /**
   * Credited contributors: activated users holding a grant on the experiment. Names
   * and avatars only — who holds which tier is the `can(share)`-gated sharing
   * routes' question. This route is `read`-gated, so it must honour
   * `anonymizeContributors` or real names leak past what the data grid hides.
   */
  async execute(experimentId: string): Promise<Result<ExperimentContributor[]>> {
    this.logger.log({
      msg: "Listing experiment contributors",
      operation: "list-experiment-contributors",
      experimentId,
    });

    const collaborators = await this.experimentRepository.listCollaborators(experimentId);

    return collaborators.map(
      ({ anonymizeContributors, collaborators: rows }: ExperimentCollaborators) =>
        rows.map(({ userId, firstName, lastName, avatarUrl }) => {
          if (!anonymizeContributors) {
            return { userId, firstName, lastName, avatarUrl };
          }
          // Same pseudonym the CONTRIBUTOR cells carry. The id is pseudonymised too,
          // or a caller could join this list back to the data grid and undo it.
          const pseudonym = this.contributorAnonymizer.pseudonymFor(experimentId, userId);
          return {
            userId: pseudonym,
            firstName: pseudonym,
            lastName: "",
            avatarUrl: null,
          };
        }),
    );
  }
}
