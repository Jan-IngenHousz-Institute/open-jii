import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentDashboardsOrpcContract } from "@repo/api/domains/experiment/experiment-dashboards.orpc";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/create-experiment-dashboard";
import { DeleteExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/delete-experiment-dashboard";
import { GetExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/get-experiment-dashboard";
import { ListExperimentDashboardsUseCase } from "../application/use-cases/experiment-dashboards/list-experiment-dashboards";
import { UpdateExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/update-experiment-dashboard";

@Controller()
export class ExperimentDashboardsOrpcController {
  private readonly logger = new Logger(ExperimentDashboardsOrpcController.name);

  constructor(
    private readonly listExperimentDashboardsUseCase: ListExperimentDashboardsUseCase,
    private readonly createExperimentDashboardUseCase: CreateExperimentDashboardUseCase,
    private readonly getExperimentDashboardUseCase: GetExperimentDashboardUseCase,
    private readonly updateExperimentDashboardUseCase: UpdateExperimentDashboardUseCase,
    private readonly deleteExperimentDashboardUseCase: DeleteExperimentDashboardUseCase,
  ) {}

  @Implement(experimentDashboardsOrpcContract.listExperimentDashboards)
  listDashboards(@Session() session: UserSession) {
    return implement(experimentDashboardsOrpcContract.listExperimentDashboards).handler(async ({ input }) => {
      const result = await this.listExperimentDashboardsUseCase.execute(input.id, session.user.id, input.limit, input.offset);
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentDashboardsOrpcContract.createExperimentDashboard)
  createDashboard(@Session() session: UserSession) {
    return implement(experimentDashboardsOrpcContract.createExperimentDashboard).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.createExperimentDashboardUseCase.execute(id, body, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentDashboardsOrpcContract.getExperimentDashboard)
  getDashboard() {
    return implement(experimentDashboardsOrpcContract.getExperimentDashboard).handler(async ({ input }) => {
      const result = await this.getExperimentDashboardUseCase.execute(input.id, input.dashboardId);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentDashboardsOrpcContract.updateExperimentDashboard)
  updateDashboard(@Session() session: UserSession) {
    return implement(experimentDashboardsOrpcContract.updateExperimentDashboard).handler(async ({ input }) => {
      const { id, dashboardId, ...body } = input;
      const result = await this.updateExperimentDashboardUseCase.execute(id, dashboardId, body, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentDashboardsOrpcContract.deleteExperimentDashboard)
  deleteDashboard(@Session() session: UserSession) {
    return implement(experimentDashboardsOrpcContract.deleteExperimentDashboard).handler(async ({ input }) => {
      const result = await this.deleteExperimentDashboardUseCase.execute(input.id, input.dashboardId, session.user.id);
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
