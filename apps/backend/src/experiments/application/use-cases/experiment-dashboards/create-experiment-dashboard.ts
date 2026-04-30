import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import {
  CreateExperimentDashboardDto,
  ExperimentDashboardDto,
} from "../../../core/models/experiment-dashboards.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDashboardRepository } from "../../../core/repositories/experiment-dashboard.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class CreateExperimentDashboardUseCase {
  private readonly logger = new Logger(CreateExperimentDashboardUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDashboardRepository: ExperimentDashboardRepository,
  ) {}

  async execute(
    experimentId: string,
    data: CreateExperimentDashboardDto,
    userId: string,
  ): Promise<Result<ExperimentDashboardDto>> {
    this.logger.log({
      msg: "Creating dashboard for experiment",
      operation: "createExperimentDashboard",
      experimentId,
      userId,
    });

    if (!data.name || data.name.trim() === "") {
      this.logger.warn({
        msg: "Invalid dashboard name provided",
        operation: "createExperimentDashboard",
        experimentId,
        userId,
      });
      return failure(AppError.badRequest("Dashboard name is required"));
    }

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasArchiveAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        hasArchiveAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Attempt to create dashboard in non-existent experiment",
            operation: "createExperimentDashboard",
            experimentId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "User does not have access to create dashboard in experiment",
            operation: "createExperimentDashboard",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const dashboardResult = await this.experimentDashboardRepository.create(
          experimentId,
          data,
          userId,
        );

        return dashboardResult.chain((dashboards: ExperimentDashboardDto[]) => {
          if (dashboards.length === 0) {
            this.logger.error({
              msg: "Failed to create dashboard",
              errorCode: ErrorCodes.EXPERIMENT_DASHBOARDS_CREATE_FAILED,
              operation: "createExperimentDashboard",
              experimentId,
              userId,
            });
            return failure(AppError.internal("Failed to create dashboard"));
          }

          const dashboard = dashboards[0];
          this.logger.log({
            msg: "Successfully created dashboard for experiment",
            operation: "createExperimentDashboard",
            experimentId,
            dashboardId: dashboard.id,
            userId,
            status: "success",
          });
          return success(dashboard);
        });
      },
    );
  }
}
