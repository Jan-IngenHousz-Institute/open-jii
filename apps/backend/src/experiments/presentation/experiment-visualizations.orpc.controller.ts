import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentVisualizationsOrpcContract } from "@repo/api/domains/experiment/experiment-visualizations.orpc";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/create-experiment-visualization";
import { DeleteExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/delete-experiment-visualization";
import { GetExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/get-experiment-visualization";
import { ListExperimentVisualizationsUseCase } from "../application/use-cases/experiment-visualizations/list-experiment-visualizations";
import { UpdateExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/update-experiment-visualization";

@Controller()
export class ExperimentVisualizationsOrpcController {
  private readonly logger = new Logger(ExperimentVisualizationsOrpcController.name);

  constructor(
    private readonly listExperimentVisualizationsUseCase: ListExperimentVisualizationsUseCase,
    private readonly createExperimentVisualizationUseCase: CreateExperimentVisualizationUseCase,
    private readonly getExperimentVisualizationUseCase: GetExperimentVisualizationUseCase,
    private readonly updateExperimentVisualizationUseCase: UpdateExperimentVisualizationUseCase,
    private readonly deleteExperimentVisualizationUseCase: DeleteExperimentVisualizationUseCase,
  ) {}

  @Implement(experimentVisualizationsOrpcContract.listExperimentVisualizations)
  listVisualizations(@Session() session: UserSession) {
    return implement(experimentVisualizationsOrpcContract.listExperimentVisualizations).handler(
      async ({ input }) => {
        const result = await this.listExperimentVisualizationsUseCase.execute(
          input.id,
          session.user.id,
        );
        if (result.isSuccess()) {
          return formatDatesList(result.value);
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentVisualizationsOrpcContract.createExperimentVisualization)
  createVisualization(@Session() session: UserSession) {
    return implement(experimentVisualizationsOrpcContract.createExperimentVisualization).handler(
      async ({ input }) => {
        const { id, ...body } = input;
        const result = await this.createExperimentVisualizationUseCase.execute(
          id,
          body,
          session.user.id,
        );
        if (result.isSuccess()) {
          return formatDates(result.value);
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentVisualizationsOrpcContract.getExperimentVisualization)
  getVisualization(@Session() session: UserSession) {
    return implement(experimentVisualizationsOrpcContract.getExperimentVisualization).handler(
      async ({ input }) => {
        const result = await this.getExperimentVisualizationUseCase.execute(
          input.id,
          input.visualizationId,
          session.user.id,
        );
        if (result.isSuccess()) {
          return formatDates(result.value);
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentVisualizationsOrpcContract.updateExperimentVisualization)
  updateVisualization(@Session() session: UserSession) {
    return implement(experimentVisualizationsOrpcContract.updateExperimentVisualization).handler(
      async ({ input }) => {
        const { id: _id, visualizationId, ...body } = input;
        const result = await this.updateExperimentVisualizationUseCase.execute(
          visualizationId,
          body,
          session.user.id,
        );
        if (result.isSuccess()) {
          return formatDates(result.value);
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentVisualizationsOrpcContract.deleteExperimentVisualization)
  deleteVisualization(@Session() session: UserSession) {
    return implement(experimentVisualizationsOrpcContract.deleteExperimentVisualization).handler(
      async ({ input }) => {
        const result = await this.deleteExperimentVisualizationUseCase.execute(
          input.visualizationId,
          session.user.id,
        );
        if (result.isSuccess()) {
          return undefined;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
