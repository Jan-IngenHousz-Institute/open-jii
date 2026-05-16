import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDashboardDto } from "../../../core/models/experiment-dashboards.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDashboardRepository } from "../../../core/repositories/experiment-dashboard.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentDashboardUseCase {
  private readonly logger = new Logger(GetExperimentDashboardUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDashboardRepository: ExperimentDashboardRepository,
  ) {}

  async execute(
    experimentId: string,
    dashboardId: string,
    userId: string,
  ): Promise<Result<ExperimentDashboardDto>> {
    this.logger.log({
      msg: "Getting dashboard of experiment",
      operation: "getExperimentDashboard",
      experimentId,
      dashboardId,
      userId,
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
            msg: "Attempt to get dashboard of non-existent experiment",
            operation: "getExperimentDashboard",
            experimentId,
            dashboardId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User does not have access to experiment dashboard",
            operation: "getExperimentDashboard",
            experimentId,
            dashboardId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const dashboardResult = await this.experimentDashboardRepository.findById(dashboardId);

        if (dashboardResult.isFailure()) {
          this.logger.error({
            msg: "Failed to retrieve dashboard for experiment",
            errorCode: ErrorCodes.EXPERIMENT_DASHBOARDS_LIST_FAILED,
            operation: "getExperimentDashboard",
            experimentId,
            dashboardId,
            userId,
            error: dashboardResult.error.message,
          });
          return failure(AppError.internal("Failed to retrieve experiment dashboard"));
        }

        const dashboard = dashboardResult.value;

        if (!dashboard) {
          this.logger.warn({
            msg: "Dashboard not found",
            operation: "getExperimentDashboard",
            experimentId,
            dashboardId,
            userId,
          });
          return failure(AppError.notFound(`Dashboard with ID ${dashboardId} not found`));
        }

        if (dashboard.experimentId !== experimentId) {
          this.logger.warn({
            msg: "Dashboard does not belong to experiment",
            operation: "getExperimentDashboard",
            experimentId,
            dashboardId,
            userId,
          });
          return failure(
            AppError.notFound(`Dashboard with ID ${dashboardId} not found in this experiment`),
          );
        }

        this.logger.debug({
          msg: "Retrieved dashboard for experiment",
          operation: "getExperimentDashboard",
          experimentId,
          dashboardId,
          userId,
        });

        return success(dashboard);
      },
    );
  }
}
