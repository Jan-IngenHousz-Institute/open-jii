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

    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Attempt to create dashboard in non-existent experiment",
          operation: "createExperimentDashboard",
          experimentId,
          userId,
        });
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      // Authorization is enforced declaratively by @CanAccess on the route.
      // Archived experiments are read-only: this is a domain rule about which
      // writes are legal, not who may write, so it stays in the use case.
      if (experiment.status === "archived") {
        this.logger.warn({
          msg: "Attempt to create dashboard in archived experiment",
          operation: "createExperimentDashboard",
          experimentId,
          userId,
        });
        return failure(AppError.forbidden("Cannot modify an archived experiment"));
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
    });
  }
}
