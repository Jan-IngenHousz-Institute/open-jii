import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/create-experiment-dashboard";
import { DeleteExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/delete-experiment-dashboard";
import { GetExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/get-experiment-dashboard";
import { ListExperimentDashboardsUseCase } from "../application/use-cases/experiment-dashboards/list-experiment-dashboards";
import { UpdateExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/update-experiment-dashboard";

@Controller()
export class ExperimentDashboardsController {
  private readonly logger = new Logger(ExperimentDashboardsController.name);

  constructor(
    private readonly listExperimentDashboardsUseCase: ListExperimentDashboardsUseCase,
    private readonly createExperimentDashboardUseCase: CreateExperimentDashboardUseCase,
    private readonly getExperimentDashboardUseCase: GetExperimentDashboardUseCase,
    private readonly updateExperimentDashboardUseCase: UpdateExperimentDashboardUseCase,
    private readonly deleteExperimentDashboardUseCase: DeleteExperimentDashboardUseCase,
  ) {}

  @TsRestHandler(contract.experiments.listExperimentDashboards)
  listDashboards(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listExperimentDashboards, async ({ params }) => {
      const result = await this.listExperimentDashboardsUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: formatDatesList(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.createExperimentDashboard)
  createDashboard(@Session() session: UserSession) {
    return tsRestHandler(
      contract.experiments.createExperimentDashboard,
      async ({ params, body }) => {
        const result = await this.createExperimentDashboardUseCase.execute(
          params.id,
          body,
          session.user.id,
        );

        if (result.isSuccess()) {
          const dashboard = result.value;
          this.logger.log({
            msg: "Dashboard created for experiment",
            operation: "createExperimentDashboard",
            experimentId: params.id,
            dashboardId: dashboard.id,
            userId: session.user.id,
            status: "success",
          });

          return {
            status: StatusCodes.CREATED as const,
            body: formatDates(dashboard),
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.getExperimentDashboard)
  getDashboard(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperimentDashboard, async ({ params }) => {
      const result = await this.getExperimentDashboardUseCase.execute(
        params.id,
        params.dashboardId,
        session.user.id,
      );

      if (result.isSuccess()) {
        const dashboard = result.value;
        this.logger.log({
          msg: "Dashboard retrieved for experiment",
          operation: "getExperimentDashboard",
          experimentId: params.id,
          dashboardId: params.dashboardId,
          userId: session.user.id,
          status: "success",
        });

        return {
          status: StatusCodes.OK as const,
          body: formatDates(dashboard),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.updateExperimentDashboard)
  updateDashboard(@Session() session: UserSession) {
    return tsRestHandler(
      contract.experiments.updateExperimentDashboard,
      async ({ params, body }) => {
        const result = await this.updateExperimentDashboardUseCase.execute(
          params.id,
          params.dashboardId,
          body,
          session.user.id,
        );

        if (result.isSuccess()) {
          const dashboard = result.value;
          this.logger.log({
            msg: "Dashboard updated",
            operation: "updateExperimentDashboard",
            experimentId: params.id,
            dashboardId: params.dashboardId,
            userId: session.user.id,
            status: "success",
          });

          return {
            status: StatusCodes.OK as const,
            body: formatDates(dashboard),
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.deleteExperimentDashboard)
  deleteDashboard(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.deleteExperimentDashboard, async ({ params }) => {
      const result = await this.deleteExperimentDashboardUseCase.execute(
        params.id,
        params.dashboardId,
        session.user.id,
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Dashboard deleted",
          operation: "deleteExperimentDashboard",
          experimentId: params.id,
          dashboardId: params.dashboardId,
          userId: session.user.id,
          status: "success",
        });

        return {
          status: StatusCodes.NO_CONTENT as const,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
