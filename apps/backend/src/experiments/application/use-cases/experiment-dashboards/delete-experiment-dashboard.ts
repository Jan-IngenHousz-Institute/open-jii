import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDashboardDto } from "../../../core/models/experiment-dashboards.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDashboardRepository } from "../../../core/repositories/experiment-dashboard.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentDashboardUseCase {
  private readonly logger = new Logger(DeleteExperimentDashboardUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDashboardRepository: ExperimentDashboardRepository,
  ) {}

  async execute(dashboardId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting dashboard",
      operation: "deleteExperimentDashboard",
      dashboardId,
      userId,
    });

    const dashboardResult = await this.experimentDashboardRepository.findById(dashboardId);

    return dashboardResult.chain(async (dashboard: ExperimentDashboardDto | null) => {
      if (!dashboard) {
        this.logger.warn({
          msg: "Attempt to delete non-existent dashboard",
          operation: "deleteExperimentDashboard",
          dashboardId,
          userId,
        });
        return failure(AppError.notFound(`Dashboard with ID ${dashboardId} not found`));
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
              operation: "deleteExperimentDashboard",
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
              operation: "deleteExperimentDashboard",
              experimentId: dashboard.experimentId,
              dashboardId,
              userId,
            });
            return failure(AppError.forbidden("You do not have access to this experiment"));
          }

          if (dashboard.createdBy !== userId && !isAdmin) {
            this.logger.warn({
              msg: "User does not have permission to delete dashboard",
              operation: "deleteExperimentDashboard",
              experimentId: dashboard.experimentId,
              dashboardId,
              userId,
            });
            return failure(
              AppError.forbidden("You do not have permission to delete this dashboard"),
            );
          }

          const deleteResult = await this.experimentDashboardRepository.delete(dashboardId);

          if (deleteResult.isFailure()) {
            this.logger.error({
              msg: "Failed to delete dashboard",
              errorCode: ErrorCodes.EXPERIMENT_DASHBOARDS_DELETE_FAILED,
              operation: "deleteExperimentDashboard",
              experimentId: dashboard.experimentId,
              dashboardId,
              userId,
              error: deleteResult.error.message,
            });
            return failure(AppError.internal("Failed to delete dashboard"));
          }

          this.logger.log({
            msg: "Successfully deleted dashboard",
            operation: "deleteExperimentDashboard",
            experimentId: dashboard.experimentId,
            dashboardId,
            userId,
            status: "success",
          });
          return success(undefined);
        },
      );
    });
  }
}
