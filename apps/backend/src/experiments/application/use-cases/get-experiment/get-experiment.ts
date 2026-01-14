import { Injectable, Logger } from "@nestjs/common";

import { EXPERIMENT_NOT_FOUND, FORBIDDEN } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentUseCase {
  private readonly logger = new Logger(GetExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, userId: string): Promise<Result<ExperimentDto>> {
    this.logger.log({
      msg: "Getting experiment",
      operation: "getExperiment",
      context: GetExperimentUseCase.name,
      experimentId: id,
      userId,
    });

    // Check if experiment exists and user has access
    const accessCheckResult = await this.experimentRepository.checkAccess(id, userId);

    return accessCheckResult.chain(
      ({ experiment, hasAccess }: { experiment: ExperimentDto | null; hasAccess: boolean }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found",
            errorCode: EXPERIMENT_NOT_FOUND,
            operation: "getExperiment",
            context: GetExperimentUseCase.name,
            experimentId: id,
          });
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        // Allow access if user is a member OR if experiment is public
        const isPublic = experiment.visibility === "public";
        if (!(hasAccess || isPublic)) {
          this.logger.warn({
            msg: "User does not have access to private experiment",
            errorCode: FORBIDDEN,
            operation: "getExperiment",
            context: GetExperimentUseCase.name,
            experimentId: id,
            userId,
          });
          return failure(
            AppError.forbidden("You do not have permission to access this experiment"),
          );
        }

        this.logger.debug({
          msg: "Experiment retrieved successfully",
          operation: "getExperiment",
          context: GetExperimentUseCase.name,
          experimentId: id,
          userId,
          isPublic,
          hasAccess,
          status: "success",
        });

        return success(experiment);
      },
    );
  }
}
