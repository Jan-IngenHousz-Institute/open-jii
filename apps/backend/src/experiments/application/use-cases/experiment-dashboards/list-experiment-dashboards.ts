import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDashboardDto } from "../../../core/models/experiment-dashboards.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDashboardRepository } from "../../../core/repositories/experiment-dashboard.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentDashboardsUseCase {
  private readonly logger = new Logger(ListExperimentDashboardsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDashboardRepository: ExperimentDashboardRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<Result<ExperimentDashboardDto[]>> {
    this.logger.log({
      msg: "Listing dashboards of experiment",
      operation: "listExperimentDashboards",
      experimentId,
      userId,
      limit,
      offset,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Attempt to list dashboards of non-existent experiment",
            operation: "listExperimentDashboards",
            experimentId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User does not have access to experiment dashboards",
            operation: "listExperimentDashboards",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const dashboardsResult = await this.experimentDashboardRepository.listDashboards(
          experimentId,
          limit,
          offset,
        );

        if (dashboardsResult.isFailure()) {
          this.logger.error({
            msg: "Failed to retrieve dashboards for experiment",
            errorCode: ErrorCodes.EXPERIMENT_DASHBOARDS_LIST_FAILED,
            operation: "listExperimentDashboards",
            experimentId,
            userId,
            error: dashboardsResult.error.message,
          });
          return failure(AppError.internal("Failed to retrieve experiment dashboards"));
        }

        this.logger.debug({
          msg: "Retrieved dashboards for experiment",
          operation: "listExperimentDashboards",
          experimentId,
          userId,
          count: dashboardsResult.value.length,
        });
        return dashboardsResult;
      },
    );
  }
}
