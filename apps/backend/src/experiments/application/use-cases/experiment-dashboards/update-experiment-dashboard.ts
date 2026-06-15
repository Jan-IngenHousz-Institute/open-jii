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
        // Rejects URL/path mismatch: PATCH /experiments/OTHER/dashboards/D where D
        // belongs to a different experiment. Same check the get use case enforces.
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

      const accessResult = await this.experimentRepository.checkAccess(
        dashboard.experimentId,
        userId,
      );

      return accessResult.chain(
        async ({
          experiment,
          hasArchiveAccess,
          isAdmin,
        }: {
          experiment: ExperimentDto | null;
          hasAccess: boolean;
          hasArchiveAccess: boolean;
          isAdmin: boolean;
        }) => {
          if (!experiment) {
            this.logger.warn({
              msg: "Dashboard belongs to non-existent experiment",
              operation: "updateExperimentDashboard",
              experimentId: dashboard.experimentId,
              dashboardId,
              userId,
            });
            return failure(
              AppError.notFound(`Experiment with ID ${dashboard.experimentId} not found`),
            );
          }

          if (!hasArchiveAccess) {
            this.logger.warn({
              msg: "User does not have access to experiment",
              operation: "updateExperimentDashboard",
              experimentId: dashboard.experimentId,
              dashboardId,
              userId,
            });
            return failure(AppError.forbidden("You do not have access to this experiment"));
          }

          if (dashboard.createdBy !== userId && !isAdmin) {
            this.logger.warn({
              msg: "User does not have permission to modify dashboard",
              operation: "updateExperimentDashboard",
              experimentId: dashboard.experimentId,
              dashboardId,
              userId,
            });
            return failure(
              AppError.forbidden("You do not have permission to modify this dashboard"),
            );
          }

          const updateResult = await this.experimentDashboardRepository.update(dashboardId, data);

          return updateResult.chain((updatedDashboards: ExperimentDashboardDto[]) => {
            if (updatedDashboards.length === 0) {
              this.logger.error({
                msg: "Failed to update dashboard",
                errorCode: ErrorCodes.EXPERIMENT_DASHBOARDS_UPDATE_FAILED,
                operation: "updateExperimentDashboard",
                experimentId: dashboard.experimentId,
                dashboardId,
                userId,
              });
              return failure(AppError.internal("Failed to update dashboard"));
            }

            const updatedDashboard = updatedDashboards[0];
            this.logger.log({
              msg: "Successfully updated dashboard",
              operation: "updateExperimentDashboard",
              experimentId: dashboard.experimentId,
              dashboardId,
              userId,
              status: "success",
            });
            return success(updatedDashboard);
          });
        },
      );
    });
  }
}
