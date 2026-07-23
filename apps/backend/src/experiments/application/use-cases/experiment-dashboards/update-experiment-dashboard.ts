import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import {
  UpdateExperimentDashboardDto,
  ExperimentDashboardDto,
} from "../../../core/models/experiment-dashboards.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDashboardRepository } from "../../../core/repositories/experiment-dashboard.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentDashboardUseCase {
  private readonly logger = new Logger(UpdateExperimentDashboardUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDashboardRepository: ExperimentDashboardRepository,
  ) {}

  async execute(
    experimentId: string,
    dashboardId: string,
    data: UpdateExperimentDashboardDto,
    userId: string,
  ): Promise<Result<ExperimentDashboardDto>> {
    this.logger.log({
      msg: "Updating dashboard",
      operation: "updateExperimentDashboard",
      experimentId,
      dashboardId,
      userId,
    });

    // The experiment is loaded (existence + archived state) BEFORE findById so a
    // 404 forking on "exists in another experiment" can't leak ids to outsiders.
    // Authorization itself is enforced declaratively by @CanAccess on the route;
    // the archived rule stays here as a domain rule about which writes are legal.
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Attempt to update dashboard of non-existent experiment",
          operation: "updateExperimentDashboard",
          experimentId,
          dashboardId,
          userId,
        });
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      if (experiment.status === "archived") {
        this.logger.warn({
          msg: "Attempt to update dashboard of archived experiment",
          operation: "updateExperimentDashboard",
          experimentId,
          dashboardId,
          userId,
        });
        return failure(AppError.forbidden("Cannot modify an archived experiment"));
      }

      const dashboardResult = await this.experimentDashboardRepository.findById(dashboardId);

      return dashboardResult.chain(async (dashboard: ExperimentDashboardDto | null) => {
        if (!dashboard) {
          this.logger.warn({
            msg: "Attempt to update non-existent dashboard",
            operation: "updateExperimentDashboard",
            experimentId,
            dashboardId,
            userId,
          });
          return failure(AppError.notFound(`Dashboard with ID ${dashboardId} not found`));
        }

        if (dashboard.experimentId !== experimentId) {
          this.logger.warn({
            msg: "Dashboard does not belong to experiment",
            operation: "updateExperimentDashboard",
            experimentId,
            dashboardId,
            userId,
          });
          return failure(
            AppError.notFound(`Dashboard with ID ${dashboardId} not found in this experiment`),
          );
        }

        const updateResult = await this.experimentDashboardRepository.update(dashboardId, data);

        return updateResult.chain((updatedDashboards: ExperimentDashboardDto[]) => {
          if (updatedDashboards.length === 0) {
            this.logger.error({
              msg: "Failed to update dashboard",
              errorCode: ErrorCodes.EXPERIMENT_DASHBOARDS_UPDATE_FAILED,
              operation: "updateExperimentDashboard",
              experimentId,
              dashboardId,
              userId,
            });
            return failure(AppError.internal("Failed to update dashboard"));
          }

          const updatedDashboard = updatedDashboards[0];
          this.logger.log({
            msg: "Successfully updated dashboard",
            operation: "updateExperimentDashboard",
            experimentId,
            dashboardId,
            userId,
            status: "success",
          });
          return success(updatedDashboard);
        });
      });
    });
  }
}
