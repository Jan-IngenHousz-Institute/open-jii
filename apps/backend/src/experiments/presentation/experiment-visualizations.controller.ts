import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/create-experiment-visualization";
import { DeleteExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/delete-experiment-visualization";
import { GetExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/get-experiment-visualization";
import { ListExperimentVisualizationsUseCase } from "../application/use-cases/experiment-visualizations/list-experiment-visualizations";
import { UpdateExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/update-experiment-visualization";

@Controller()
export class ExperimentVisualizationsController {
  private readonly logger = new Logger(ExperimentVisualizationsController.name);

  constructor(
    private readonly listExperimentVisualizationsUseCase: ListExperimentVisualizationsUseCase,
    private readonly createExperimentVisualizationUseCase: CreateExperimentVisualizationUseCase,
    private readonly getExperimentVisualizationUseCase: GetExperimentVisualizationUseCase,
    private readonly updateExperimentVisualizationUseCase: UpdateExperimentVisualizationUseCase,
    private readonly deleteExperimentVisualizationUseCase: DeleteExperimentVisualizationUseCase,
  ) {}

  @TsRestHandler(contract.experiments.listExperimentVisualizations)
  listVisualizations(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listExperimentVisualizations, async ({ params }) => {
      const result = await this.listExperimentVisualizationsUseCase.execute(
        params.id,
        session.user.id,
      );

      if (result.isSuccess()) {
        const visualizations = formatDatesList(result.value);
        return {
          status: StatusCodes.OK as const,
          body: visualizations,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.createExperimentVisualization)
  createVisualization(@Session() session: UserSession) {
    return tsRestHandler(
      contract.experiments.createExperimentVisualization,
      async ({ params, body }) => {
        const result = await this.createExperimentVisualizationUseCase.execute(
          params.id,
          body,
          session.user.id,
        );

        if (result.isSuccess()) {
          const visualization = result.value;
          this.logger.log(
            `Visualization "${visualization.name}" created for experiment ${params.id} by user ${session.user.id}`,
          );

          return {
            status: StatusCodes.CREATED as const,
            body: formatDates(visualization),
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.getExperimentVisualization)
  getVisualization(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperimentVisualization, async ({ params }) => {
      const result = await this.getExperimentVisualizationUseCase.execute(
        params.id,
        params.visualizationId,
        session.user.id,
      );

      if (result.isSuccess()) {
        const visualization = result.value;
        this.logger.log(
          `Visualization ${params.visualizationId} retrieved for experiment ${params.id} by user ${session.user.id}`,
        );

        return {
          status: StatusCodes.OK as const,
          body: formatDates(visualization),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.updateExperimentVisualization)
  updateVisualization(@Session() session: UserSession) {
    return tsRestHandler(
      contract.experiments.updateExperimentVisualization,
      async ({ params, body }) => {
        const result = await this.updateExperimentVisualizationUseCase.execute(
          params.visualizationId,
          body,
          session.user.id,
        );

        if (result.isSuccess()) {
          const visualization = result.value;
          this.logger.log(
            `Visualization ${params.visualizationId} updated by user ${session.user.id}`,
          );

          return {
            status: StatusCodes.OK as const,
            body: formatDates(visualization),
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.deleteExperimentVisualization)
  deleteVisualization(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.deleteExperimentVisualization, async ({ params }) => {
      const result = await this.deleteExperimentVisualizationUseCase.execute(
        params.visualizationId,
        session.user.id,
      );

      if (result.isSuccess()) {
        this.logger.log(
          `Visualization ${params.visualizationId} deleted by user ${session.user.id}`,
        );

        return {
          status: StatusCodes.NO_CONTENT as const,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
