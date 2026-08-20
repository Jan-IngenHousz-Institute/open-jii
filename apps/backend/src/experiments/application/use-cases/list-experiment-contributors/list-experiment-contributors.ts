import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentContributors } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, success } from "../../../../common/utils/fp-utils";
import {
  collaboratorCountKey,
  SharingRepository,
} from "../../../../sharing/core/repositories/sharing.repository";
import type { ExperimentCollaborators } from "../../../core/repositories/experiment.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ContributorAnonymizerService } from "../../services/contributor-anonymizer.service";

@Injectable()
export class ListExperimentContributorsUseCase {
  private readonly logger = new Logger(ListExperimentContributorsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly contributorAnonymizer: ContributorAnonymizerService,
    private readonly authz: AuthorizationService,
    private readonly sharingRepository: SharingRepository,
  ) {}

  /**
   * Credited contributors: activated users holding a grant on the experiment. Names
   * and avatars only — who holds which tier is the `can(share)`-gated sharing
   * routes' question. This route is `read`-gated, so it must honour
   * `anonymizeContributors` or real names leak past what the data grid hides.
   *
   * The count is deliberately wider than those faces: it is the collaborators
   * surface's own arithmetic, so the overview and the organization's resource cards
   * cannot state two different numbers under the word "collaborators". Read from
   * {@link SharingRepository.countCollaborators} rather than recomputed here, which
   * is what keeps them one number.
   */
  async execute(experimentId: string): Promise<Result<ExperimentContributors>> {
    this.logger.log({
      msg: "Listing experiment contributors",
      operation: "list-experiment-contributors",
      experimentId,
    });

    const collaborators = await this.experimentRepository.listCollaborators(experimentId);
    if (collaborators.isFailure()) return collaborators;

    // Read rather than carried, unlike the sharing use-cases: this route is guarded by
    // `@CanAccess`, which does not hand its decision to the handler. What a transfer in
    // that window changes is a count of this experiment's own collaborators — no
    // identity and no other organization's roster — so it is narrower than the leak the
    // carried decision prevents there. Moving the check into this use-case would close
    // it; that is an authorization change, not a fix.
    const ownership = await this.authz.getOwnership("experiment", experimentId);
    const counts = await this.sharingRepository.countCollaborators(
      ownership?.organizationId ?? null,
      [{ resourceType: "experiment", resourceId: experimentId }],
    );
    if (counts.isFailure()) return counts;

    return success({
      contributors: this.credit(experimentId, collaborators.value),
      collaboratorCount: counts.value.get(collaboratorCountKey("experiment", experimentId)) ?? 0,
    });
  }

  /** The faces the overview credits, pseudonymised when the experiment says so. */
  private credit(
    experimentId: string,
    { anonymizeContributors, collaborators: rows }: ExperimentCollaborators,
  ) {
    return rows.map(({ userId, firstName, lastName, avatarUrl }) => {
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
    });
  }
}
