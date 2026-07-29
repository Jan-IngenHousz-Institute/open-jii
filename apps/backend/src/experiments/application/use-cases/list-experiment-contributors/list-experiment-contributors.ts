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
   * The experiment's credited contributors: the activated users who hold a grant on
   * it, and can therefore add data to it.
   *
   * Read authorization is enforced declaratively on the route. This returns names
   * and avatars only — who holds *which* tier is a separate, `can(share)`-gated
   * question answered by the sharing routes.
   *
   * **Honours `anonymizeContributors`.** This route is `read`-gated, so on a public
   * experiment it answers to anyone; publishing real names from it would defeat the
   * experiment's own anonymization setting, which the data grid already respects.
   * When the flag is on, every caller gets the same pseudonyms the measurement rows
   * carry — so the two surfaces agree on who "Contributor-A1B2C3" is. People who may
   * actually administer sharing still see real identities through the
   * `can(share)`-gated collaborators list, which is a different route and unaffected.
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
          // The same pseudonym the CONTRIBUTOR cells carry, split across the two name
          // fields the UI renders. The user id is pseudonymised too: leaving it real
          // would let a caller join this list back to the data grid and undo it.
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
