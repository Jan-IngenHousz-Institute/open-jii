import { Injectable, Logger } from "@nestjs/common";

import type { JoinCodePreview } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentJoinCodeRepository } from "../../../core/repositories/experiment-join-code.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { joinCodeNotFound, joinCodeRefusal } from "./join-code-validity";

/** The preview, with `expiresAt` still a Date for the controller to format. */
export type JoinCodePreviewDto = Omit<JoinCodePreview, "expiresAt"> & { expiresAt: Date | null };

@Injectable()
export class ResolveJoinCodeUseCase {
  private readonly logger = new Logger(ResolveJoinCodeUseCase.name);

  constructor(
    private readonly joinCodeRepository: ExperimentJoinCodeRepository,
    private readonly experimentRepository: ExperimentRepository,
    private readonly authz: AuthorizationService,
  ) {}

  /** Read-only. Nothing is written and the redemption counter does not move. */
  async execute(code: string, userId: string): Promise<Result<JoinCodePreviewDto>> {
    this.logger.log({ msg: "Resolving a join code", operation: "resolve-join-code", userId });

    const codeResult = await this.joinCodeRepository.findByCode(code);
    if (codeResult.isFailure()) {
      return failure(AppError.internal("Failed to resolve join code"));
    }
    if (!codeResult.value) {
      return failure(joinCodeNotFound());
    }
    const joinCode = codeResult.value;

    const experimentResult = await this.joinCodeRepository.findExperiment(joinCode.experimentId);
    if (experimentResult.isFailure() || !experimentResult.value) {
      return failure(AppError.internal("Failed to resolve join code"));
    }
    const experiment = experimentResult.value;

    const refusal = joinCodeRefusal(joinCode, experiment, new Date());
    if (refusal) {
      return failure(refusal);
    }

    const decision = await this.authz.can(userId, {
      resourceType: "experiment",
      resourceId: experiment.id,
      action: "contribute",
    });
    const membershipStatus = await this.experimentRepository.membershipStatusFor(
      experiment.id,
      userId,
      decision.allow,
    );
    if (membershipStatus.isFailure()) {
      return failure(AppError.internal("Failed to resolve join code"));
    }

    return success({
      experiment: {
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        organizationName: experiment.organizationName,
        status: experiment.status,
        hasWorkbook: experiment.workbookVersionId !== null,
      },
      membershipStatus: membershipStatus.value,
      expiresAt: joinCode.expiresAt,
    });
  }
}
