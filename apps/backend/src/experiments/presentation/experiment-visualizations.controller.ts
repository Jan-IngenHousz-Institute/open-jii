import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentVisualizationsContract } from "@repo/api/domains/experiment/experiment-visualizations.contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
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

  @Implement(experimentVisualizationsContract.listExperimentVisualizations)
  listVisualizations(@Session() session: UserSession) {
    return implement(experimentVisualizationsContract.listExperimentVisualizations).handler(
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

  @Implement(experimentVisualizationsContract.createExperimentVisualization)
  createVisualization(@Session() session: UserSession) {
    return implement(experimentVisualizationsContract.createExperimentVisualization).handler(
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

  @Implement(experimentVisualizationsContract.getExperimentVisualization)
  getVisualization(@Session() session: UserSession) {
    return implement(experimentVisualizationsContract.getExperimentVisualization).handler(
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

  @Implement(experimentVisualizationsContract.updateExperimentVisualization)
  updateVisualization(@Session() session: UserSession) {
    return implement(experimentVisualizationsContract.updateExperimentVisualization).handler(
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

  @Implement(experimentVisualizationsContract.deleteExperimentVisualization)
  deleteVisualization(@Session() session: UserSession) {
    return implement(experimentVisualizationsContract.deleteExperimentVisualization).handler(
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
