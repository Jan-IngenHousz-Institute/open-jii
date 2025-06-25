import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  formatDates,
  formatDatesList,
} from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateExperimentUseCase } from "../application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "../application/use-cases/delete-experiment/delete-experiment";
import { GetExperimentUseCase } from "../application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "../application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "../application/use-cases/update-experiment/update-experiment";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentController {
  private readonly logger = new Logger(ExperimentController.name);

  constructor(
    private readonly createExperimentUseCase: CreateExperimentUseCase,
    private readonly getExperimentUseCase: GetExperimentUseCase,
    private readonly listExperimentsUseCase: ListExperimentsUseCase,
    private readonly updateExperimentUseCase: UpdateExperimentUseCase,
    private readonly deleteExperimentUseCase: DeleteExperimentUseCase,
  ) {}

  @TsRestHandler(contract.experiments.createExperiment)
  createExperiment(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.createExperiment,
      async ({ body }) => {
        const result = await this.createExperimentUseCase.execute(
          body,
          user.id,
        );

        if (result.isSuccess()) {
          const experiment = result.value;

          this.logger.log(
            `Experiment created: ${experiment.id} by user ${user.id}`,
          );
          return {
            status: StatusCodes.CREATED,
            body: experiment,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.getExperiment)
  getExperiment(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.getExperiment,
      async ({ params }) => {
        const result = await this.getExperimentUseCase.execute(
          params.id,
          user.id,
        );

        if (result.isSuccess()) {
          const experiment = result.value;

          // Format dates to strings for the API contract
          const formattedExperiment = formatDates(experiment);

          this.logger.log(`Experiment ${params.id} retrieved`);
          return {
            status: StatusCodes.OK,
            body: formattedExperiment,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.listExperiments)
  listExperiments(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.listExperiments,
      async ({ query }) => {
        const result = await this.listExperimentsUseCase.execute(
          user.id,
          query.filter,
          query.status,
        );

        if (result.isSuccess()) {
          const experiments = result.value;

          // Format dates to strings for the API contract
          const formattedExperiments = formatDatesList(experiments);

          this.logger.log(
            `Listed experiments for user ${user.id} with filter: ${JSON.stringify(
              query.filter,
            )}, status: ${query.status}`,
          );
          return {
            status: StatusCodes.OK,
            body: formattedExperiments,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.updateExperiment)
  updateExperiment(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.updateExperiment,
      async ({ params, body }) => {
        const result = await this.updateExperimentUseCase.execute(
          params.id,
          body,
          user.id,
        );

        if (result.isSuccess()) {
          const experiment = result.value;

          // Format dates to strings for the API contract
          const formattedExperiment = formatDates(experiment);

          this.logger.log(`Experiment ${params.id} updated by user ${user.id}`);
          return {
            status: StatusCodes.OK,
            body: formattedExperiment,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.deleteExperiment)
  deleteExperiment(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.deleteExperiment,
      async ({ params }) => {
        const result = await this.deleteExperimentUseCase.execute(
          params.id,
          user.id,
        );

        if (result.isSuccess()) {
          this.logger.log(`Experiment ${params.id} deleted`);
          return {
            status: StatusCodes.NO_CONTENT,
            body: null,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }
}
